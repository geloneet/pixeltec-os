import { z } from 'zod';
import { anthropicCreate } from '@/lib/ai/anthropic-egress';
import { getModel } from './client';
import type { PostSource } from '../types';

/**
 * Generación asistida del BRIEF completo a partir del problema del lector
 * (WS2+ — petición de Miguel 2026-08-03/04). Reglas duras:
 *  - Frontera anthropic-egress, jamás SDK directo.
 *  - Fuentes REALES vía web search SERVER-SIDE de Anthropic (la búsqueda corre
 *    en la infraestructura de Anthropic: nuestra red solo habla con
 *    api.anthropic.com — ADR-0028 intacta). Candado anti-alucinación: una
 *    fuente solo se acepta si su URL aparece LITERALMENTE en los resultados de
 *    búsqueda de la respuesta; lo demás cae a sourceSuggestions (texto).
 *  - `verifiedByHuman` SIEMPRE false al generar: el humano abre la fuente y
 *    confirma que respalda el claim — el gate de publicación bloquea lo no
 *    verificado.
 *  - La experiencia PixelTEC no se inventa: prefijo "[CONFIRMAR]".
 *  - Audiencia por defecto: emprendedores y PyMEs SIN formación técnica.
 */

const SITE_INTERNAL_URLS = [
  '/services',
  '/services/ecosistemas-web',
  '/services/automatizacion',
  '/services/consultoria',
  '/pixelbot',
  '/diagnostico',
  '/blog',
  '/contact',
] as const;

const BRIEF_AI_SYSTEM_PROMPT = `Eres el estratega de contenidos de PixelTEC, agencia mexicana (Puerto Vallarta) que construye software a medida, automatización e IA para PyMEs.

Tu tarea: a partir del PROBLEMA DEL LECTOR, investigar y producir un brief editorial completo para un artículo del blog.

AUDIENCIA (regla maestra): dueños de negocio, emprendedores y responsables de operación de PyMEs mexicanas SIN formación técnica. Nada de jerga de programación; el lector piensa en ventas, tiempo, costos y clientes — no en código.

INVESTIGACIÓN DE FUENTES (obligatoria):
- Usa la herramienta de búsqueda web (2-4 búsquedas) para encontrar fuentes REALES que respalden los claims probables del artículo: datos oficiales (INEGI, Meta/WhatsApp Business, asociaciones), estudios de consultoras, documentación oficial.
- En el JSON final, llena "sources" SOLO con fuentes cuyas URL copiaste EXACTAMENTE de los resultados de búsqueda — jamás construyas ni recuerdes una URL de memoria.
- Para cada fuente: title (el real del resultado), url (exacta), publisher, sourceType (official | primary-research | regulation | technical-documentation | reputable-secondary), claimSupported (qué afirmación concreta respaldaría).
- Lo que valdría la pena citar pero NO encontraste con confianza va en "sourceSuggestions" (descripción de qué buscar, SIN URL).

REGLAS DEL BRIEF:
- searchIntent y funnelStage: el más realista para ese problema.
- primaryKeyword: búsqueda REAL long-tail en español de México, como la escribiría un dueño de negocio. secondaryKeywords: 3-6 variantes.
- keyPoints: 3-6 puntos prácticos y accionables.
- tone: por defecto "educativo".
- internalLinkTargets: SOLO de esta lista: ${SITE_INTERNAL_URLS.join(', ')} — 2-3 con purpose y suggestedAnchor.
- pixeltecExperience: 2-3 sugerencias comenzando EXACTAMENTE con "[CONFIRMAR] " — tú no conoces los proyectos reales.
- PROHIBIDO inventar: métricas, casos, clientes, URLs, títulos de estudios.
- contentGoal y desiredAction: concretos, en el contexto del funnel de PixelTEC (diagnóstico, contacto, PixelBot).

OUTPUT FINAL: después de investigar, tu ÚLTIMO mensaje de texto debe ser SOLO un objeto JSON válido (sin fences ni texto extra) con EXACTAMENTE estas claves:
{"topic": string, "angle": string, "targetAudience": string, "keyPoints": string[], "tone": "técnico-directo"|"educativo"|"opinión-defendida"|"caso-práctico", "searchIntent": "informational"|"commercial-investigation"|"transactional"|"navigational", "funnelStage": "awareness"|"consideration"|"decision", "primaryKeyword": string, "secondaryKeywords": string[], "entities": string[], "contentPillar": string, "contentGoal": string, "desiredAction": string, "pixeltecExperience": string[], "internalLinkTargets": [{"url": string, "purpose": string, "suggestedAnchor": string}], "sources": [{"title": string, "url": string, "publisher": string, "sourceType": string, "claimSupported": string}], "sourceSuggestions": string[]}`;

const AiSourceSchema = z.object({
  title: z.string().min(3).max(300),
  url: z.string().url(),
  publisher: z.string().max(200).catch(''),
  sourceType: z
    .enum(['official', 'primary-research', 'regulation', 'technical-documentation', 'reputable-secondary', 'pixeltec-evidence'])
    .catch('reputable-secondary'),
  claimSupported: z.string().max(500).catch(''),
});

const AiBriefSchema = z.object({
  topic: z.string().min(5).max(200).catch(''),
  angle: z.string().min(10).max(500).catch(''),
  targetAudience: z.string().min(5).max(200).catch('Dueños de PyMEs y emprendedores en México'),
  keyPoints: z.array(z.string().min(2).max(200)).min(2).max(8).catch([]),
  tone: z.enum(['técnico-directo', 'educativo', 'opinión-defendida', 'caso-práctico']).catch('educativo'),
  searchIntent: z.enum(['informational', 'commercial-investigation', 'transactional', 'navigational']).or(z.literal('')).catch(''),
  funnelStage: z.enum(['awareness', 'consideration', 'decision']).or(z.literal('')).catch(''),
  primaryKeyword: z.string().max(120).catch(''),
  secondaryKeywords: z.array(z.string().min(1).max(120)).max(10).catch([]),
  entities: z.array(z.string().min(1).max(120)).max(15).catch([]),
  contentPillar: z.string().max(120).catch(''),
  contentGoal: z.string().max(300).catch(''),
  desiredAction: z.string().max(300).catch(''),
  pixeltecExperience: z.array(z.string().min(1).max(500)).max(10).catch([]),
  internalLinkTargets: z
    .array(
      z.object({
        url: z.string(),
        purpose: z.string().max(300).catch(''),
        suggestedAnchor: z.string().max(120).catch(''),
      })
    )
    .max(10)
    .catch([]),
  sources: z.array(AiSourceSchema).max(8).catch([]),
  sourceSuggestions: z.array(z.string().min(3).max(400)).max(8).catch([]),
});

export type AiBrief = Omit<z.infer<typeof AiBriefSchema>, 'sources'> & {
  userProblem: string;
  /** Fuentes REALES (URL presente en resultados de búsqueda), pendientes de
   *  verificación humana. */
  sources: PostSource[];
};

export interface GenerateBriefOptions {
  userProblem: string;
  /** Regeneración: qué no gustó / qué cambiar del intento anterior. */
  feedback?: string;
  /** Brief anterior (JSON serializable) para que la corrección sea dirigida. */
  previous?: Record<string, unknown>;
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('La respuesta no contiene JSON');
  return JSON.parse(trimmed.slice(start, end + 1));
}

const normalizeUrl = (u: string) => u.trim().replace(/\/+$/, '');

/** URLs que la búsqueda web devolvió de verdad en esta respuesta. */
function collectSearchResultUrls(content: unknown[]): Set<string> {
  const urls = new Set<string>();
  for (const block of content as Array<Record<string, unknown>>) {
    if (block?.type !== 'web_search_tool_result') continue;
    const results = block.content;
    if (!Array.isArray(results)) continue;
    for (const r of results as Array<Record<string, unknown>>) {
      if (typeof r?.url === 'string') urls.add(normalizeUrl(r.url));
    }
  }
  return urls;
}

export async function generateBriefFromProblem(opts: GenerateBriefOptions): Promise<AiBrief> {
  const { userProblem, feedback, previous } = opts;

  const userPrompt = previous && feedback
    ? `PROBLEMA DEL LECTOR:\n${userProblem}\n\nBRIEF ANTERIOR (tu intento previo):\n${JSON.stringify(previous)}\n\nFEEDBACK DEL EDITOR (corrige el brief según esto, conservando lo que no se objeta):\n${feedback}\n\nDevuelve el JSON corregido completo.`
    : `PROBLEMA DEL LECTOR:\n${userProblem}\n\nInvestiga las fuentes y genera el brief completo en JSON.`;

  const message = await anthropicCreate({
    operation: 'generate_text',
    model: getModel(),
    buildParams: () => ({
      max_tokens: 4096,
      system: BRIEF_AI_SYSTEM_PROMPT,
      tools: [
        {
          type: 'web_search_20250305' as const,
          name: 'web_search' as const,
          max_uses: 4,
        },
      ],
      messages: [{ role: 'user' as const, content: userPrompt }],
    }),
  });

  const rawOutput = message.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('');

  const parsed = AiBriefSchema.parse(extractJson(rawOutput));

  // Los enlaces internos solo pueden apuntar a rutas reales del sitio.
  const validInternal = new Set<string>(SITE_INTERNAL_URLS);
  parsed.internalLinkTargets = parsed.internalLinkTargets.filter((l) => validInternal.has(l.url));

  // Candado anti-alucinación: fuente sin URL respaldada por la búsqueda real
  // NO entra como fuente — degrada a sugerencia de búsqueda.
  const searchedUrls = collectSearchResultUrls(message.content as unknown[]);
  const today = new Date().toISOString().slice(0, 10);
  const accepted: PostSource[] = [];
  for (const s of parsed.sources) {
    if (searchedUrls.has(normalizeUrl(s.url))) {
      accepted.push({
        id: `ai-${accepted.length + 1}-${today}`,
        title: s.title,
        url: normalizeUrl(s.url),
        publisher: s.publisher,
        sourceType: s.sourceType,
        claimSupported: s.claimSupported,
        accessedAt: today,
        verifiedByHuman: false,
      });
    } else {
      parsed.sourceSuggestions.push(`${s.title}${s.publisher ? ` (${s.publisher})` : ''} — URL no confirmada por la búsqueda, encuéntrala manualmente`);
    }
  }

  const { sources: _dropped, ...rest } = parsed;
  return { ...rest, sources: accepted, userProblem };
}
