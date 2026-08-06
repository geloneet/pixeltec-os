'use server';

// Fase 4 (rebanada Blog): Postgres — antes Firestore `blogPosts`.
// WS2 (SEO integral): gate de publicación en servidor, rol admin para
// publicar/archivar/despublicar, updatePost sin despublicación silenciosa y
// cambio de slug con redirect 301 persistente.
import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { blogPosts, postRedirects } from '@/lib/db/schema';
import { requireUserSession } from '@/lib/auth/session';
import { requireAdmin } from '@/lib/auth-guards';
import { getUserDisplayName, resolvePostRow } from '../pg';
import { BlogPostEditSchema, type BlogPostEditInput, type ActionResult } from '../schemas';
import { computeWordCount, computeReadingTime, generateSlug } from '../ai/generate-post';
import {
  normalizeCandidate,
  validatePostForPublication,
  SLUG_RE,
  type PublicationVerdict,
} from '../publication-gate';
import { EMPTY_EDITORIAL, EMPTY_SEO, type PostEditorial } from '../types';
import { logBlogActivity } from '../activity';

type Row = typeof blogPosts.$inferSelect;

function revalidatePublicSurfaces(slug?: string | null) {
  revalidatePath('/blog');
  if (slug) revalidatePath(`/blog/${slug}`);
  revalidatePath('/sitemap.xml');
}

/** Slug único y LEGIBLE: desambigua con -2, -3… (antes: `-${Date.now()}`).
 *  Evita chocar también contra redirects históricos (cadena/loop). */
async function uniqueSlug(base: string, excludePostId?: string): Promise<string> {
  let candidate = base;
  for (let i = 2; ; i++) {
    const clashWhere = excludePostId
      ? and(eq(blogPosts.slug, candidate), sql`${blogPosts.id} <> ${excludePostId}`)
      : eq(blogPosts.slug, candidate);
    const [clash] = await db.select({ id: blogPosts.id }).from(blogPosts).where(clashWhere).limit(1);
    const [redirectClash] = await db
      .select({ fromSlug: postRedirects.fromSlug })
      .from(postRedirects)
      .where(eq(postRedirects.fromSlug, candidate))
      .limit(1);
    if (!clash && !redirectClash) return candidate;
    candidate = `${base}-${i}`;
  }
}

function mergedSeo(row: Row, input: BlogPostEditInput) {
  const current = { ...EMPTY_SEO, ...(row.seo as Record<string, unknown>) };
  return {
    ...current,
    // SIN truncado silencioso (SEO-BLOG-020): completos; el gate advierte.
    metaTitle: input.seoMetaTitle ?? current.metaTitle ?? row.title,
    metaDescription: input.seoMetaDescription ?? current.metaDescription ?? row.excerpt,
    ...(input.coverImageAlt !== undefined ? { ogImageAlt: input.coverImageAlt } : {}),
    ...(input.coverAttribution !== undefined ? { coverAttribution: input.coverAttribution } : {}),
    ...(input.canonicalUrl !== undefined ? { canonicalUrl: input.canonicalUrl } : {}),
    ...(input.noindex !== undefined ? { noindex: input.noindex } : {}),
    ...(input.primaryKeyword !== undefined ? { primaryKeyword: input.primaryKeyword } : {}),
    ...(input.secondaryKeywords !== undefined ? { secondaryKeywords: input.secondaryKeywords } : {}),
    ...(input.searchIntent !== undefined ? { searchIntent: input.searchIntent } : {}),
    ...(input.contentPillar !== undefined ? { contentPillar: input.contentPillar } : {}),
  };
}

function mergedEditorial(row: Row, input: BlogPostEditInput): PostEditorial {
  const current = { ...EMPTY_EDITORIAL, ...(row.editorial as Partial<PostEditorial>) };
  return {
    ...current,
    ...(input.reviewerId !== undefined ? { reviewerId: input.reviewerId } : {}),
    ...(input.nextReviewAt !== undefined ? { nextReviewAt: input.nextReviewAt } : {}),
    ...(input.aiDisclosure !== undefined ? { aiDisclosure: input.aiDisclosure } : {}),
    ...(input.claimsVerified !== undefined ? { claimsVerified: input.claimsVerified } : {}),
    ...(input.sourcesVerified !== undefined ? { sourcesVerified: input.sourcesVerified } : {}),
  };
}

/** «Escribir desde cero»: crea un borrador manual mínimo y devuelve su id para
 *  abrir el editor. Sin brief ni IA — `ai` vacío deja claro que es 100% humano
 *  (el gate de revisión humana no aplica). El título y la categoría son
 *  placeholders editables; el slug definitivo se resuelve al publicar. */
export async function createManualPost(): Promise<ActionResult<{ id: string }>> {
  const session = await requireUserSession();
  if (!session) return { ok: false, error: 'No autenticado' };

  const authorName = await getUserDisplayName(session.userId);
  const title = 'Borrador sin título';
  const slug = await uniqueSlug(generateSlug(title));

  const [inserted] = await db
    .insert(blogPosts)
    .values({
      slug,
      title,
      excerpt: '',
      body: '',
      category: 'automatización',
      tags: [],
      coverImage: null,
      author: { name: authorName, uid: session.userId },
      status: 'draft',
      briefSource: {},
      ai: {},
      seo: { ...EMPTY_SEO, metaTitle: title, noindex: true },
      editorial: { ...EMPTY_EDITORIAL, reviewerId: session.userId },
      sources: [],
      internalLinks: [],
      wordCount: 0,
      readingTimeMin: 1,
    })
    .returning({ id: blogPosts.id });

  if (!inserted) return { ok: false, error: 'No se pudo crear el borrador' };

  await logBlogActivity({
    postId: inserted.id,
    type: 'creado',
    message: 'Borrador creado desde cero (sin IA)',
    actorId: session.userId,
    actorName: authorName,
  });

  return { ok: true, data: { id: inserted.id } };
}

export async function updatePost(postId: string, input: BlogPostEditInput): Promise<ActionResult> {
  const session = await requireUserSession();
  if (!session) return { ok: false, error: 'No autenticado' };

  const parsed = BlogPostEditSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos inválidos' };
  }

  const row = await resolvePostRow(postId);
  if (!row) return { ok: false, error: 'Post no encontrado' };

  const {
    seoMetaTitle: _mt,
    seoMetaDescription: _md,
    coverImageAlt: _alt,
    coverAttribution: _cattr,
    canonicalUrl: _canon,
    noindex: _noidx,
    primaryKeyword: _pk,
    secondaryKeywords: _sk,
    searchIntent: _si,
    contentPillar: _cp,
    sources,
    internalLinks,
    reviewerId: _rev,
    nextReviewAt: _next,
    aiDisclosure: _dis,
    claimsVerified: _cv,
    sourcesVerified: _sv,
    ...content
  } = parsed.data;
  const wordCount = computeWordCount(content.body);
  const readingTimeMin = computeReadingTime(wordCount);
  const seo = mergedSeo(row, parsed.data);
  const editorial = mergedEditorial(row, parsed.data);
  const ai = { ...(row.ai as Record<string, unknown>), editedByHuman: true };

  const wasPublished = row.status === 'published';
  if (wasPublished) {
    // P0-1: editar un post publicado NO lo despublica. Se registra la fecha de
    // revisión y se revalida; despublicar es una acción explícita aparte.
    editorial.lastReviewedAt = new Date().toISOString();
  }

  // B-PR2: guardar NO cambia el estado — enviar a revisión es un acto
  // explícito (`requestReview`). Antes, cualquier guardado empujaba el post
  // a needs-review, contradiciendo las acciones contextuales del dictamen.
  await db
    .update(blogPosts)
    .set({
      ...content,
      wordCount,
      readingTimeMin,
      ai,
      seo,
      editorial,
      ...(sources !== undefined ? { sources } : {}),
      ...(internalLinks !== undefined ? { internalLinks } : {}),
      updatedAt: new Date(),
    })
    .where(eq(blogPosts.id, row.id));

  if (wasPublished) revalidatePublicSurfaces(row.slug);

  await logBlogActivity({
    postId: row.id,
    type: 'editado',
    message: 'Edición guardada',
    actorId: session.userId,
    actorName: await getUserDisplayName(session.userId),
  });

  return { ok: true };
}

/** draft → needs-review, como acto EXPLÍCITO del autor (dictamen: la acción
 *  primaria de un borrador es «Enviar a revisión», no un efecto del guardado). */
export async function requestReview(postId: string): Promise<ActionResult> {
  const session = await requireUserSession();
  if (!session) return { ok: false, error: 'No autenticado' };

  const row = await resolvePostRow(postId);
  if (!row) return { ok: false, error: 'Artículo no encontrado' };
  if (row.status !== 'draft') {
    return { ok: false, error: `Solo un borrador puede enviarse a revisión (estado actual: ${row.status})` };
  }

  await db
    .update(blogPosts)
    .set({ status: 'needs-review', updatedAt: new Date() })
    .where(eq(blogPosts.id, row.id));

  await logBlogActivity({
    postId: row.id,
    type: 'enviado-a-revision',
    message: 'Enviado a revisión',
    actorId: session.userId,
    actorName: await getUserDisplayName(session.userId),
  });

  return { ok: true };
}

/** needs-review/approved → draft con comentario OBLIGATORIO: sin comentarios,
 *  «revisión» es solo otro estado de color (dictamen §12). El comentario vive
 *  en blog_activity (`devuelto`) y el editor lo muestra como banner. */
export async function returnWithComments(postId: string, comment: string): Promise<ActionResult> {
  const guard = await requireAdmin(undefined, { route: 'blog:return' });
  if (!guard.ok) return { ok: false, error: guard.error };

  const trimmed = comment.trim();
  if (trimmed.length < 5) {
    return { ok: false, error: 'Escribe un comentario para el autor (mínimo 5 caracteres).' };
  }

  const row = await resolvePostRow(postId);
  if (!row) return { ok: false, error: 'Artículo no encontrado' };
  if (row.status !== 'needs-review' && row.status !== 'approved') {
    return { ok: false, error: `Solo se devuelve un artículo en revisión o aprobado (estado actual: ${row.status})` };
  }

  await db
    .update(blogPosts)
    .set({ status: 'draft', updatedAt: new Date() })
    .where(eq(blogPosts.id, row.id));

  await logBlogActivity({
    postId: row.id,
    type: 'devuelto',
    message: trimmed.slice(0, 500),
    actorId: guard.uid,
    actorName: await getUserDisplayName(guard.uid),
  });

  return { ok: true };
}

/** archived → draft. El diálogo de archivar siempre prometió «puedes
 *  restaurarlo más tarde» — este es el control que faltaba. */
export async function unarchivePost(postId: string): Promise<ActionResult> {
  const guard = await requireAdmin(undefined, { route: 'blog:unarchive' });
  if (!guard.ok) return { ok: false, error: guard.error };

  const row = await resolvePostRow(postId);
  if (!row) return { ok: false, error: 'Artículo no encontrado' };
  if (row.status !== 'archived') {
    return { ok: false, error: 'El artículo no está archivado.' };
  }

  await db
    .update(blogPosts)
    .set({ status: 'draft', updatedAt: new Date() })
    .where(eq(blogPosts.id, row.id));

  await logBlogActivity({
    postId: row.id,
    type: 'restaurado-archivo',
    message: 'Restaurado del archivo como borrador',
    actorId: guard.uid,
    actorName: await getUserDisplayName(guard.uid),
  });

  return { ok: true };
}

export async function approvePost(postId: string): Promise<ActionResult> {
  const session = await requireUserSession();
  if (!session) return { ok: false, error: 'No autenticado' };

  const row = await resolvePostRow(postId);
  if (!row) return { ok: false, error: 'Post no encontrado' };

  const editorial: PostEditorial = {
    ...EMPTY_EDITORIAL,
    ...(row.editorial as Partial<PostEditorial>),
    reviewerId: session.userId,
    reviewedAt: new Date().toISOString(),
  };

  await db
    .update(blogPosts)
    .set({ status: 'approved', approvedBy: session.userId, editorial, updatedAt: new Date() })
    .where(eq(blogPosts.id, row.id));

  await logBlogActivity({
    postId: row.id,
    type: 'aprobado',
    message: 'Artículo aprobado',
    actorId: session.userId,
    actorName: await getUserDisplayName(session.userId),
  });

  return { ok: true };
}

/** Corre el gate sin publicar — el editor lo usa para el panel de readiness. */
export async function getPublicationReadiness(postId: string): Promise<ActionResult<PublicationVerdict>> {
  const session = await requireUserSession();
  if (!session) return { ok: false, error: 'No autenticado' };
  const row = await resolvePostRow(postId);
  if (!row) return { ok: false, error: 'Post no encontrado' };
  return { ok: true, data: validatePostForPublication(normalizeCandidate(row)) };
}

export async function publishPost(postId: string): Promise<ActionResult<PublicationVerdict>> {
  // Publicar es outward-facing: exige rol admin, no solo sesión.
  const guard = await requireAdmin(undefined, { route: 'blog:publish' });
  if (!guard.ok) return { ok: false, error: guard.error };

  const row = await resolvePostRow(postId);
  if (!row) return { ok: false, error: 'Post no encontrado' };

  // Gate EN SERVIDOR (P0-2): el estado y el contenido se validan aquí, no en
  // el botón. El slug se evalúa sobre el candidato ya resuelto.
  let slug = row.slug;
  if (!slug) {
    slug = await uniqueSlug(generateSlug(row.title), row.id);
  }

  const verdict = validatePostForPublication(normalizeCandidate({ ...row, slug }));
  if (!verdict.ready) {
    return {
      ok: false,
      data: verdict,
      error: `No publicable: ${verdict.blockers.map((b) => b.message).join(' · ')}`,
    };
  }

  const wordCount = computeWordCount(row.body);
  const readingTimeMin = computeReadingTime(wordCount);
  const seo = { ...EMPTY_SEO, ...(row.seo as Record<string, unknown>), noindex: false };
  const aiMeta = (row.ai ?? {}) as Record<string, unknown>;
  const editorial: PostEditorial = {
    ...EMPTY_EDITORIAL,
    ...(row.editorial as Partial<PostEditorial>),
    aiAssisted: Boolean(aiMeta.model),
  };

  await db
    .update(blogPosts)
    .set({
      status: 'published',
      slug,
      wordCount,
      readingTimeMin,
      publishedAt: row.publishedAt ?? new Date(),
      approvedBy: guard.uid,
      seo,
      editorial,
      updatedAt: new Date(),
    })
    .where(eq(blogPosts.id, row.id));

  revalidatePublicSurfaces(slug);

  await logBlogActivity({
    postId: row.id,
    type: 'publicado',
    message: `Publicado en /blog/${slug}`,
    actorId: guard.uid,
    actorName: await getUserDisplayName(guard.uid),
    metadata: verdict.warnings.length > 0 ? { warningsAceptadas: verdict.warnings.map((w) => w.code) } : null,
  });

  return { ok: true, data: verdict };
}

export async function archivePost(postId: string): Promise<ActionResult> {
  const guard = await requireAdmin(undefined, { route: 'blog:archive' });
  if (!guard.ok) return { ok: false, error: guard.error };

  const row = await resolvePostRow(postId);
  if (!row) return { ok: false, error: 'Post no encontrado' };

  await db
    .update(blogPosts)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(eq(blogPosts.id, row.id));

  // Un post que estaba publicado debe salir del listado, de su URL y del
  // sitemap sin esperar la ventana ISR.
  revalidatePublicSurfaces(row.slug);

  await logBlogActivity({
    postId: row.id,
    type: 'archivado',
    message: 'Artículo archivado',
    actorId: guard.uid,
    actorName: await getUserDisplayName(guard.uid),
  });

  return { ok: true };
}

export async function setPostStatus(
  postId: string,
  status: 'draft' | 'needs-review' | 'approved',
): Promise<ActionResult> {
  // Despublicar (published → draft/needs-review/approved) cambia visibilidad
  // pública: mismo nivel de privilegio que publicar.
  const guard = await requireAdmin(undefined, { route: 'blog:set-status' });
  if (!guard.ok) return { ok: false, error: guard.error };

  const row = await resolvePostRow(postId);
  if (!row) return { ok: false, error: 'Post no encontrado' };

  await db.update(blogPosts).set({ status, updatedAt: new Date() }).where(eq(blogPosts.id, row.id));

  revalidatePublicSurfaces(row.slug);

  return { ok: true };
}

/** Cambia el slug con confirmación explícita. Si el post está publicado, el
 *  slug anterior queda como redirect 301 permanente (post_redirects) — los
 *  enlaces externos e indexados siguen funcionando. */
export async function changeSlug(postId: string, newSlugRaw: string): Promise<ActionResult<{ slug: string }>> {
  const guard = await requireAdmin(undefined, { route: 'blog:change-slug' });
  if (!guard.ok) return { ok: false, error: guard.error };

  const newSlug = newSlugRaw.trim().toLowerCase();
  if (!SLUG_RE.test(newSlug)) {
    return { ok: false, error: 'Slug inválido: minúsculas, números y guiones (ej. mi-articulo-2026).' };
  }

  const row = await resolvePostRow(postId);
  if (!row) return { ok: false, error: 'Post no encontrado' };
  if (row.slug === newSlug) return { ok: true, data: { slug: newSlug } };

  const finalSlug = await uniqueSlug(newSlug, row.id);
  if (finalSlug !== newSlug) {
    return { ok: false, error: `El slug "${newSlug}" ya está ocupado (post o redirect existente).` };
  }

  const oldSlug = row.slug;
  const wasPublished = row.status === 'published';

  await db.transaction(async (tx) => {
    // Si el nuevo slug era un redirect que apuntaba a este post, se retira
    // para no crear un loop slug→redirect→slug.
    await tx.delete(postRedirects).where(and(eq(postRedirects.fromSlug, newSlug), eq(postRedirects.postId, row.id)));
    await tx.update(blogPosts).set({ slug: newSlug, updatedAt: new Date() }).where(eq(blogPosts.id, row.id));
    if (wasPublished && oldSlug) {
      await tx
        .insert(postRedirects)
        .values({ fromSlug: oldSlug, postId: row.id })
        .onConflictDoUpdate({ target: postRedirects.fromSlug, set: { postId: row.id } });
    }
  });

  if (wasPublished) {
    revalidatePublicSurfaces(oldSlug);
    revalidatePath(`/blog/${newSlug}`);
  }

  await logBlogActivity({
    postId: row.id,
    type: 'slug-cambiado',
    message: `Slug cambiado: ${oldSlug} → ${newSlug}`,
    actorId: guard.uid,
    actorName: await getUserDisplayName(guard.uid),
    metadata: { from: oldSlug, to: newSlug, redirect: wasPublished },
  });

  return { ok: true, data: { slug: newSlug } };
}
