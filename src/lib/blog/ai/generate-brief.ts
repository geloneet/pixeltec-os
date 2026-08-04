import { z } from 'zod';
import { anthropicCreate } from '@/lib/ai/anthropic-egress';
import { getModel } from './client';

/**
 * Generación asistida del BRIEF completo a partir del problema del lector
 * (WS2+ — petición de Miguel 2026-08-03). Mismas reglas duras que el resto
 * del pipeline IA:
 *  - Frontera anthropic-egress, jamás SDK directo.
 *  - CERO fuentes con URL inventada: el modelo sugiere QUÉ buscar
 *    (sourceSuggestions, texto libre) y el humano encuentra/verifica la URL
 *    real en el formulario — el gate de publicación bloquea lo no verificado.
 *  - La experiencia PixelTEC no se inventa: cada entrada va prefijada con
 *    "[CONFIRMAR]" para que el humano la valide o la borre.
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

Tu tarea: a partir del PROBLEMA DEL LECTOR que te dan, investigar con tu conocimiento y producir un brief editorial completo para un artículo del blog.

AUDIENCIA (regla maestra): dueños de negocio, emprendedores y responsables de operación de PyMEs mexicanas SIN formación técnica. Nada de jerga de programación en topic/angle/keyPoints; si un concepto técnico es inevitable, se plantea desde el beneficio de negocio. El lector piensa en ventas, tiempo, costos y clientes — no en código.

REGLAS:
- searchIntent y funnelStage: elige el más realista para ese problema.
- primaryKeyword: una búsqueda REAL y alcanzable en español de México (long-tail), como la escribiría un dueño de negocio en Google. secondaryKeywords: 3-6 variantes.
- keyPoints: 3-6 puntos que respondan el problema de forma práctica y accionable.
- tone: por defecto "educativo" salvo que el problema pida otro.
- internalLinkTargets: SOLO URLs de esta lista (las únicas que existen): ${SITE_INTERNAL_URLS.join(', ')} — elige 2-3 que aporten de verdad, con purpose y suggestedAnchor.
- pixeltecExperience: 2-3 sugerencias de experiencia propia que PixelTEC PODRÍA aportar, cada una comenzando EXACTAMENTE con "[CONFIRMAR] " — el humano las valida; tú no conoces los proyectos reales.
- sourceSuggestions: 2-4 descripciones de fuentes que valdría la pena BUSCAR (institución/tipo de dato + qué respaldaría). PROHIBIDO incluir URLs — el humano encuentra y verifica la fuente real.
- PROHIBIDO inventar: métricas, casos, clientes, URLs, títulos exactos de estudios.
- contentGoal y desiredAction: concretos y medibles en el contexto del funnel de PixelTEC (diagnóstico, contacto, PixelBot).

OUTPUT: SOLO un objeto JSON válido (sin markdown, sin fences, sin texto extra) con EXACTAMENTE estas claves:
{"topic": string, "angle": string, "targetAudience": string, "keyPoints": string[], "tone": "técnico-directo"|"educativo"|"opinión-defendida"|"caso-práctico", "searchIntent": "informational"|"commercial-investigation"|"transactional"|"navigational", "funnelStage": "awareness"|"consideration"|"decision", "primaryKeyword": string, "secondaryKeywords": string[], "entities": string[], "contentPillar": string, "contentGoal": string, "desiredAction": string, "pixeltecExperience": string[], "internalLinkTargets": [{"url": string, "purpose": string, "suggestedAnchor": string}], "sourceSuggestions": string[]}`;

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
  sourceSuggestions: z.array(z.string().min(3).max(400)).max(8).catch([]),
});

export type AiBrief = z.infer<typeof AiBriefSchema> & { userProblem: string };

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

export async function generateBriefFromProblem(opts: GenerateBriefOptions): Promise<AiBrief> {
  const { userProblem, feedback, previous } = opts;

  const userPrompt = previous && feedback
    ? `PROBLEMA DEL LECTOR:\n${userProblem}\n\nBRIEF ANTERIOR (tu intento previo):\n${JSON.stringify(previous)}\n\nFEEDBACK DEL EDITOR (corrige el brief según esto, conservando lo que no se objeta):\n${feedback}\n\nDevuelve el JSON corregido completo.`
    : `PROBLEMA DEL LECTOR:\n${userProblem}\n\nGenera el brief completo en JSON.`;

  const message = await anthropicCreate({
    operation: 'generate_text',
    model: getModel(),
    buildParams: () => ({
      max_tokens: 2048,
      system: BRIEF_AI_SYSTEM_PROMPT,
      messages: [{ role: 'user' as const, content: userPrompt }],
    }),
  });

  const rawOutput = message.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('');

  const parsed = AiBriefSchema.parse(extractJson(rawOutput));

  // Los enlaces internos solo pueden apuntar a rutas reales del sitio.
  const validUrls = new Set<string>(SITE_INTERNAL_URLS);
  parsed.internalLinkTargets = parsed.internalLinkTargets.filter((l) => validUrls.has(l.url));

  return { ...parsed, userProblem };
}
