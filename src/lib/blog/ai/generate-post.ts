import { z } from 'zod';
import { anthropicCreate } from '@/lib/ai/anthropic-egress';
import { getModel } from './client';
import { BLOG_SYSTEM_PROMPT } from './system-prompt';
import type { BlogBriefDoc } from '../types';

export interface GeneratedPost {
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  coverImage: string | null;
  body: string;
  rawOutput: string;
  /** Modelo REAL reportado por el response del proveedor (antes se anotaba el
   *  de la env var, que podía divergir del que respondió). */
  modelUsed: string;
}

function stripCodeFenceWrapper(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*)\n```\s*$/);
  return match ? match[1] : trimmed;
}

// Validación del front-matter con Zod (.catch = resiliente a un modelo que se
// desvía: el campo cae a su default en vez de romper la generación entera; la
// coerción queda declarada, no escondida en Strings sueltos).
const FrontMatterSchema = z.object({
  title: z.string().min(5).catch(''),
  excerpt: z.string().catch(''),
  category: z.enum(['arquitectura', 'automatización', 'case-study', 'opinión']).catch('arquitectura'),
  tags: z.array(z.string().min(1)).max(8).catch([]),
  coverImage: z.string().catch(''),
});

function parseFrontMatterRaw(raw: string): Record<string, unknown> {
  const normalized = stripCodeFenceWrapper(raw).replace(/\r\n/g, '\n');
  const result: Record<string, unknown> = {};
  const match = normalized.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return result;

  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();

    if (value.startsWith('[') && value.endsWith(']')) {
      result[key] = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else {
      result[key] = value.replace(/^["']|["']$/g, '');
    }
  }
  return result;
}

function extractBody(raw: string): string {
  const normalized = stripCodeFenceWrapper(raw).replace(/\r\n/g, '\n');
  return normalized.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
}

/** El brief completo del artículo. Se arma diferido: ver `generatePostFromBrief`. */
function buildUserPrompt(brief: BlogBriefDoc): string {
  const strategyLines: string[] = [];
  if (brief.userProblem) strategyLines.push(`**Problema del lector:** ${brief.userProblem}`);
  if (brief.searchIntent) strategyLines.push(`**Intención de búsqueda:** ${brief.searchIntent}`);
  if (brief.primaryKeyword) strategyLines.push(`**Keyword principal (uso natural):** ${brief.primaryKeyword}`);
  if (brief.secondaryKeywords?.length) strategyLines.push(`**Keywords secundarias:** ${brief.secondaryKeywords.join(', ')}`);
  if (brief.entities?.length) strategyLines.push(`**Entidades/conceptos a cubrir:** ${brief.entities.join(', ')}`);
  if (brief.funnelStage) strategyLines.push(`**Etapa del funnel:** ${brief.funnelStage}`);
  if (brief.contentGoal) strategyLines.push(`**Objetivo del contenido:** ${brief.contentGoal}`);
  if (brief.desiredAction) strategyLines.push(`**Acción deseada del lector:** ${brief.desiredAction}`);

  const experience = brief.pixeltecExperience?.length
    ? `\n**Experiencia propia de PixelTEC (intégrala, es la diferencia):**\n${brief.pixeltecExperience.map((e, i) => `${i + 1}. ${e}`).join('\n')}`
    : '';

  const sources = brief.sources?.length
    ? `\n**Fuentes DISPONIBLES (las únicas que puedes citar):**\n${brief.sources
        .map((s, i) => `${i + 1}. [${s.title}](${s.url}) — ${s.publisher || 'sin editor'}${s.claimSupported ? ` · respalda: ${s.claimSupported}` : ''}`)
        .join('\n')}`
    : '\n**Fuentes:** ninguna proporcionada — marca todo claim factual externo con [FUENTE PENDIENTE].';

  const internalLinks = brief.internalLinkTargets?.length
    ? `\n**Enlaces internos sugeridos (integra los que aporten):**\n${brief.internalLinkTargets
        .map((l) => `- ${l.url}${l.suggestedAnchor ? ` (anchor sugerido: "${l.suggestedAnchor}")` : ''}${l.purpose ? ` — ${l.purpose}` : ''}`)
        .join('\n')}`
    : '';

  return `Escribe un artículo de blog para PixelTEC con la siguiente información:

**Tema:** ${brief.topic}
**Ángulo técnico:** ${brief.angle}
**Audiencia objetivo:** ${brief.targetAudience}
${strategyLines.join('\n')}
**Puntos clave a cubrir:**
${brief.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}
**Tono:** ${brief.tone}
${experience}${sources}${internalLinks}

Sigue el formato de output especificado con front-matter YAML.`;
}

export async function generatePostFromBrief(brief: BlogBriefDoc): Promise<GeneratedPost> {
  // El prompt se construye dentro de la fábrica diferida y el cliente lo
  // instancia el adaptador: si la política de egress bloquea, ni el brief ni el
  // SDK llegan a existir.
  const message = await anthropicCreate({
    operation: 'generate_text',
    model: getModel(),
    buildParams: () => ({
      max_tokens: 8192,
      system: BLOG_SYSTEM_PROMPT,
      messages: [{ role: 'user' as const, content: buildUserPrompt(brief) }],
    }),
  });

  const rawOutput =
    message.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as { type: 'text'; text: string }).text)
      .join('') ?? '';

  const fm = FrontMatterSchema.parse(parseFrontMatterRaw(rawOutput));
  const body = extractBody(rawOutput);

  return {
    title: fm.title || brief.topic,
    excerpt: fm.excerpt.slice(0, 160),
    category: fm.category,
    tags: fm.tags,
    coverImage: fm.coverImage || null,
    body,
    rawOutput,
    modelUsed: (message as { model?: string }).model ?? getModel(),
  };
}

export function computeWordCount(body: string): number {
  return body.trim().split(/\s+/).filter(Boolean).length;
}

export function computeReadingTime(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 200));
}

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}
