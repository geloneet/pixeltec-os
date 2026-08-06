'use server';

/**
 * Herramientas de IA del editor (B-PR6): PROPONEN, no escriben.
 *
 * Cada action devuelve `{ proposal }` y es el CLIENTE quien decide aplicarlo
 * al formulario (setValue + shouldDirty) — este módulo no importa `db` a
 * propósito: la única action de IA que escribe a la base sigue siendo
 * `regenerateDraft`. Toda inferencia va vía `anthropicCreate` de
 * `@/lib/ai/anthropic-egress` (ADR-0028), con max_tokens acotado ≤ 1024.
 */
import { anthropicCreate } from '@/lib/ai/anthropic-egress';
import { getModel } from '../ai/client';
import { requireUserSession } from '@/lib/auth/session';
import { resolvePostRow } from '../pg';
import { extractToneTarget, isBlogTone } from '../ai-tools-logic';
import type { ActionResult } from '../schemas';
import { toPublicFailure } from '@/lib/errors/public-failure';

export interface AiToolProposal {
  proposal: string;
}

type PostRowLike = {
  title: string;
  excerpt: string;
  body: string;
  category: string;
  briefSource: unknown;
  seo: unknown;
};

/** Contexto compacto del artículo para los prompts (el cuerpo se recorta —
 *  estas herramientas afinan piezas, no re-leen el artículo entero). */
function postContext(row: PostRowLike): string {
  const brief = (row.briefSource ?? {}) as Record<string, unknown>;
  const seo = (row.seo ?? {}) as Record<string, unknown>;
  const lines = [
    `Título actual: ${row.title}`,
    `Extracto actual: ${row.excerpt}`,
    `Categoría: ${row.category}`,
  ];
  if (brief.targetAudience) lines.push(`Audiencia objetivo: ${brief.targetAudience as string}`);
  if (brief.tone) lines.push(`Tono definido en el brief: ${brief.tone as string}`);
  if (seo.primaryKeyword) lines.push(`Keyword principal (uso natural): ${seo.primaryKeyword as string}`);
  lines.push(`Inicio del cuerpo (Markdown):\n${row.body.slice(0, 1500)}`);
  return lines.join('\n');
}

const SYSTEM = `Eres editor senior del blog técnico de PixelTEC (agencia mexicana de software). Escribes en español de México, claro y sin relleno. Respondes ÚNICAMENTE con el texto pedido: sin comillas envolventes, sin explicaciones, sin front-matter y sin bloques de código.`;

async function propose(userPrompt: string, maxTokens: number): Promise<string> {
  const message = await anthropicCreate({
    operation: 'generate_text',
    model: getModel(),
    buildParams: () => ({
      max_tokens: maxTokens,
      system: SYSTEM,
      messages: [{ role: 'user' as const, content: userPrompt }],
    }),
  });
  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('')
    .trim();
}

type ToolName = 'improve_title' | 'improve_excerpt' | 'improve_fragment' | 'adjust_tone';

async function runTool(
  postId: string,
  tool: ToolName,
  build: (row: PostRowLike) => { prompt: string; maxTokens: number }
): Promise<ActionResult<AiToolProposal>> {
  const session = await requireUserSession();
  if (!session) return { ok: false, error: 'No autenticado' };

  const row = await resolvePostRow(postId);
  if (!row) return { ok: false, error: 'Post no encontrado' };

  try {
    const { prompt, maxTokens } = build(row);
    const proposal = await propose(prompt, maxTokens);
    if (!proposal) return { ok: false, error: 'La IA no devolvió una propuesta.' };
    return { ok: true, data: { proposal } };
  } catch (err) {
    console.error(`ai-tools ${tool} error:`, err);
    return {
      ok: false,
      error: toPublicFailure(err, {
        code: `blog_ai_tool_failed`,
        message: 'Error generando la propuesta con IA',
      }).message,
    };
  }
}

/** Propone un título mejorado (claridad + intención de búsqueda). */
export async function improveTitle(postId: string): Promise<ActionResult<AiToolProposal>> {
  return runTool(postId, 'improve_title', (row) => ({
    maxTokens: 256,
    prompt: `${postContext(row)}

Propón UN título mejorado para este artículo: específico, honesto con el contenido, atractivo para la audiencia y con la keyword principal integrada de forma natural si existe. Máximo ~70 caracteres. Responde solo con el título.`,
  }));
}

/** Propone un extracto reescrito (≤160 caracteres, para SEO y listados). */
export async function improveExcerpt(postId: string): Promise<ActionResult<AiToolProposal>> {
  return runTool(postId, 'improve_excerpt', (row) => ({
    maxTokens: 300,
    prompt: `${postContext(row)}

Reescribe el extracto del artículo: máximo 160 caracteres, una o dos frases que resuman el valor concreto para el lector (sin clickbait). Responde solo con el extracto.`,
  }));
}

/** Propone una mejora del fragmento SELECCIONADO del cuerpo. */
export async function improveFragment(
  postId: string,
  selection: string
): Promise<ActionResult<AiToolProposal>> {
  const fragment = selection?.trim() ?? '';
  if (fragment.length < 10) {
    return { ok: false, error: 'Selecciona un fragmento del cuerpo (mínimo 10 caracteres).' };
  }
  if (fragment.length > 4000) {
    return { ok: false, error: 'El fragmento seleccionado es demasiado largo (máximo 4000 caracteres).' };
  }
  return runTool(postId, 'improve_fragment', (row) => ({
    maxTokens: 1024,
    prompt: `${postContext(row)}

Mejora SOLO este fragmento del cuerpo (claridad, ritmo y precisión), conservando su significado, su formato Markdown y su longitud aproximada:

---
${fragment}
---

Responde solo con el fragmento reescrito.`,
  }));
}

/**
 * Propone la INTRODUCCIÓN del artículo (hasta el primer H2) reescrita en el
 * tono indicado — mismo objetivo que calcula el cliente con
 * `extractToneTarget`, para que la propuesta sea aplicable de forma exacta.
 * (El cuerpo completo no cabe en el presupuesto max_tokens ≤ 1024 sin
 * truncarse, y aplicar una propuesta truncada destruiría contenido.)
 */
export async function adjustTone(
  postId: string,
  tone: string
): Promise<ActionResult<AiToolProposal>> {
  if (!isBlogTone(tone)) {
    return { ok: false, error: 'Tono no reconocido.' };
  }
  return runTool(postId, 'adjust_tone', (row) => {
    const { target } = extractToneTarget(row.body);
    return {
      maxTokens: 1024,
      prompt: `${postContext(row)}

Reescribe ÚNICAMENTE esta introducción del artículo en tono «${tone}», conservando los hechos, los enlaces y el formato Markdown (incluido el H1 si existe). No agregues secciones nuevas:

---
${target}
---

Responde solo con la introducción reescrita.`,
    };
  });
}
