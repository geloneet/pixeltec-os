'use server';

/**
 * Wizard IA del Blog (WO-2026-00088 D-C-bis): paridad con
 * `src/app/actions/ai-article.ts` de Encino (Gemini) adaptada al cliente
 * Anthropic YA existente (`@/lib/ai/anthropic-egress`, política ADR-0028) —
 * sin dependencias ni variables de entorno nuevas. Como en Encino, PROPONE:
 * devuelve el artículo/FAQ al editor y solo persiste `ai_params`.
 */
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { blogPosts } from '@/lib/db/schema';
import { anthropicCreate } from '@/lib/ai/anthropic-egress';
import { parseModelJson } from '@/lib/ai/model-json';
import { getModel } from '@/lib/blog/ai/client';
import { requireUserSession } from '@/lib/auth/session';
import { getPublishedPosts } from '@/lib/blog/queries/posts';
import { logBlogActivity } from '@/lib/blog/activity';
import type { ActionResult } from '@/lib/blog/schemas';
import { toPublicFailure } from '@/lib/errors/public-failure';
import {
  AiArticleResultSchema,
  AiFaqResultSchema,
  GenerateArticleSchema,
  GenerateFaqSchema,
  type AiArticleResult,
} from './schemas';

/** Catálogo de enlaces internos que el modelo puede usar (nunca inventa URLs):
 *  páginas fijas del sitio + artículos publicados. */
const STATIC_INTERNAL_LINKS = ['/', '/services', '/pixelbot', '/diagnostico', '/blog', '/about', '/contact'] as const;

async function internalLinkCatalog(excludeSlug?: string): Promise<string[]> {
  const posts = await getPublishedPosts().catch(() => []);
  return [
    ...STATIC_INTERNAL_LINKS,
    ...posts.filter((p) => p.slug !== excludeSlug).slice(0, 30).map((p) => `/blog/${p.slug}`),
  ];
}

function stripJsonFence(raw: string): string {
  const t = raw.trim();
  const m = t.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/);
  return m ? m[1] : t;
}

async function askJson(system: string, user: string, maxTokens: number): Promise<unknown> {
  const message = await anthropicCreate({
    operation: 'generate_text',
    model: getModel(),
    buildParams: () => ({
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user' as const, content: user }],
    }),
  });
  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('');
  // WO-2026-00220: `parseModelJson`, no `JSON.parse` crudo. El SyntaxError de
  // V8 incrusta un fragmento de la respuesta del modelo en su mensaje, así que
  // un `console.error(err)` aguas arriba acababa escribiendo en los logs texto
  // generado sobre el cliente. `parseModelJson` falla con un código fijo.
  return parseModelJson<unknown>(stripJsonFence(text));
}

const ARTICLE_SYSTEM = `Eres redactor senior del blog de PixelTEC (agencia mexicana de software, Puerto Vallarta). Escribes en español de México para PyMEs sin formación técnica: claro, útil, sin relleno ni promesas. Respondes ÚNICAMENTE con un objeto JSON válido, sin comentarios ni bloques de código, con exactamente estas claves: "title" (string), "metaDescription" (string ≤ 160 caracteres), "tags" (array de 1 a 6 strings cortos), "body" (string en Markdown: empieza en "##", usa H2/H3, párrafos cortos, listas cuando aporten; jamás un "# " nivel 1; sin HTML).`;

export async function generateBlogCmsArticle(raw: unknown): Promise<ActionResult<AiArticleResult>> {
  const session = await requireUserSession();
  if (!session) return { ok: false, error: 'No autenticado' };
  const parsed = GenerateArticleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Datos del wizard inválidos.' };
  const input = parsed.data;
  try {
    const [row] = await db.select({ id: blogPosts.id, slug: blogPosts.slug }).from(blogPosts).where(eq(blogPosts.id, input.postId)).limit(1);
    if (!row) return { ok: false, error: 'Entrada no encontrada' };
    const catalog = await internalLinkCatalog(row.slug);
    const prompt = [
      `Brief del artículo:\n${input.brief}`,
      `Tono: ${input.tone}. Audiencia: ${input.audience}.`,
      `Incluye hasta ${input.internalLinkCount} enlaces internos ÚNICAMENTE de esta lista (rutas relativas): ${catalog.join(', ')}.`,
      `Incluye hasta ${input.externalLinkCount} enlaces externos a fuentes reales y reconocidas; si no estás seguro de una URL, no la inventes: omítela.`,
      input.modification && input.currentBody
        ? `Ya existe una versión (título: "${input.currentTitle ?? ''}"). Reescríbela aplicando esta modificación: ${input.modification}\n\nVersión actual (Markdown):\n${input.currentBody.slice(0, 20_000)}`
        : '',
    ].filter(Boolean).join('\n\n');

    const result = AiArticleResultSchema.parse(await askJson(ARTICLE_SYSTEM, prompt, 8192));
    const article: AiArticleResult = {
      ...result,
      metaDescription: result.metaDescription.slice(0, 160),
      tags: result.tags.map((t) => t.trim()).filter(Boolean).slice(0, 8),
      body: result.body.replace(/^#\s+.*\n+/, ''),
    };

    await db
      .update(blogPosts)
      .set({
        aiParams: {
          brief: input.brief,
          tone: input.tone,
          audience: input.audience,
          internalLinkCount: input.internalLinkCount,
          externalLinkCount: input.externalLinkCount,
        },
        ai: { model: getModel(), generatedAt: new Date().toISOString(), editedByHuman: false, wordsAdded: 0, iterations: 1 },
        updatedAt: new Date(),
      })
      .where(eq(blogPosts.id, row.id));
    await logBlogActivity({ postId: row.id, type: input.modification ? 'regenerado-ia' : 'generado-ia', message: input.modification ? 'Artículo regenerado con IA' : 'Artículo generado con IA', actorId: session.userId });
    return { ok: true, data: article };
  } catch (err) {
    console.error('[blog-cms] generateArticle:', err instanceof Error ? err.name : typeof err);
    return { ok: false, error: toPublicFailure(err, { code: 'blog_cms_ai_failed', message: 'No se pudo generar el artículo con IA.' }).message };
  }
}

const FAQ_SYSTEM = `Eres editor del blog de PixelTEC. Respondes ÚNICAMENTE con un objeto JSON válido {"faq":[{"question":"…","answer":"…"}]} en español de México, sin bloques de código. Las respuestas son breves (1-3 frases), fieles al artículo y sin inventar datos.`;

export async function generateBlogCmsFaq(raw: unknown): Promise<ActionResult<{ faq: { question: string; answer: string }[] }>> {
  const session = await requireUserSession();
  if (!session) return { ok: false, error: 'No autenticado' };
  const parsed = GenerateFaqSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos.' };
  const input = parsed.data;
  try {
    const prompt = [
      `Genera ${input.count} preguntas frecuentes con su respuesta sobre este artículo.`,
      input.existingQuestions.length ? `No repitas estas preguntas: ${input.existingQuestions.join(' | ')}` : '',
      `Título: ${input.title}`,
      `Artículo (Markdown):\n${input.body.slice(0, 20_000)}`,
    ].filter(Boolean).join('\n\n');
    const result = AiFaqResultSchema.parse(await askJson(FAQ_SYSTEM, prompt, 2048));
    return { ok: true, data: { faq: result.faq.slice(0, input.count) } };
  } catch (err) {
    console.error('[blog-cms] generateFaq:', err instanceof Error ? err.name : typeof err);
    return { ok: false, error: toPublicFailure(err, { code: 'blog_cms_ai_faq_failed', message: 'No se pudo generar la FAQ con IA.' }).message };
  }
}
