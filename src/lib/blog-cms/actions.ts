'use server';

/**
 * Server Actions del Blog (WO-2026-00088, paridad Encino `src/app/actions/blog.ts`)
 * adaptadas a PixelTEC OS: NextAuth (`requireUserSession` para leer/crear/
 * editar; `requireAdmin` para publicar/programar/archivar/eliminar/categorías —
 * política vigente del blog: lo que cambia visibilidad pública exige admin),
 * Drizzle sobre las MISMAS tablas del blog legacy, revisiones en
 * `blog_post_versions`, historial en `blog_activity`, revalidación de las
 * superficies públicas existentes.
 */
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { blogPosts } from '@/lib/db/schema';
import { requireUserSession } from '@/lib/auth/session';
import { requireAdmin } from '@/lib/auth-guards';
import { getUserDisplayName, resolvePostRow } from '@/lib/blog/pg';
import { logBlogActivity } from '@/lib/blog/activity';
import { snapshotPost, restoreVersion, listVersions, type BlogPostVersionMeta } from '@/lib/blog/versions';
import { computeWordCount, computeReadingTime, generateSlug } from '@/lib/blog/ai/generate-post';
import { SLUG_RE } from '@/lib/blog/publication-gate';
import { EMPTY_EDITORIAL, EMPTY_SEO, type BlogFaqItem, type PostEditorial } from '@/lib/blog/types';
import type { ActionResult } from '@/lib/blog/schemas';
import { toPublicFailure } from '@/lib/errors/public-failure';
import {
  CreateCategorySchema,
  SaveBlogCmsPostSchema,
  type SaveBlogCmsPostInput,
} from './schemas';
import { resolveSaveTransition } from './transitions';
import { extractMapsEmbedUrl } from './maps-embed';
import {
  deleteBlogCategory,
  deleteBlogPostIfEmpty,
  uniqueBlogSlug,
  upsertBlogCategory,
} from './queries';
import { ADMIN_BLOG_PATH } from './paths';

function revalidateBlogSurfaces(slugs: Array<string | null | undefined>) {
  revalidatePath('/blog');
  for (const s of slugs) if (s) revalidatePath(`/blog/${s}`);
  revalidatePath('/sitemap.xml');
  revalidatePath(ADMIN_BLOG_PATH);
}

function randomSuffix(): string {
  return crypto.randomUUID().slice(0, 8);
}

function fail(err: unknown, code: string, message: string): ActionResult<never> {
  console.error(`[blog-cms] ${code}:`, err instanceof Error ? err.name : typeof err);
  return { ok: false, error: toPublicFailure(err, { code, message }).message };
}

// ── Crear ───────────────────────────────────────────────────────────────────

/** Crea un borrador vacío y devuelve su id (el editor se abre por redirect
 *  desde la UI). `modo: 'ia'` solo cambia el query string del destino. */
export async function createBlogCmsDraft(): Promise<ActionResult<{ id: string }>> {
  const session = await requireUserSession();
  if (!session) return { ok: false, error: 'No autenticado' };
  try {
    const authorName = await getUserDisplayName(session.userId);
    const slug = await uniqueBlogSlug(`borrador-${randomSuffix()}`);
    const [inserted] = await db
      .insert(blogPosts)
      .values({
        slug,
        title: '',
        excerpt: '',
        body: '',
        category: '',
        tags: [],
        coverImage: null,
        author: { name: authorName, uid: session.userId },
        status: 'draft',
        briefSource: {},
        ai: {},
        seo: { ...EMPTY_SEO, noindex: false },
        editorial: { ...EMPTY_EDITORIAL },
        sources: [],
        internalLinks: [],
        faq: [],
        wordCount: 0,
        readingTimeMin: 1,
      })
      .returning({ id: blogPosts.id });
    if (!inserted) return { ok: false, error: 'No se pudo crear el borrador' };
    await logBlogActivity({ postId: inserted.id, type: 'creado', message: 'Entrada creada (Blog)', actorId: session.userId, actorName: authorName });
    return { ok: true, data: { id: inserted.id } };
  } catch (err) {
    return fail(err, 'blog_cms_create_failed', 'No se pudo crear la entrada.');
  }
}

/** Descarta un borrador si sigue vacío (cerrar el wizard IA sin escribir). */
export async function discardEmptyBlogCmsDraft(postId: string): Promise<ActionResult<{ deleted: boolean }>> {
  const session = await requireUserSession();
  if (!session) return { ok: false, error: 'No autenticado' };
  if (!/^[0-9a-f-]{36}$/i.test(postId)) return { ok: true, data: { deleted: false } };
  try {
    const deleted = await deleteBlogPostIfEmpty(postId);
    if (deleted) revalidatePath(ADMIN_BLOG_PATH);
    return { ok: true, data: { deleted } };
  } catch (err) {
    return fail(err, 'blog_cms_discard_failed', 'No se pudo descartar el borrador.');
  }
}

// ── Guardar (autosave / borrador / publicar / programar) ────────────────────

export interface SaveBlogCmsResult {
  slug: string;
  status: string;
  publishedAt: string | null;
  scheduledAt: string | null;
}

/** Blockers de INTEGRIDAD (subconjunto del gate legacy que no depende del
 *  flujo editorial de revisión, ajeno a Encino). */
function integrityBlockers(input: { title: string; body: string; slug: string; coverImage: string | null }): string[] {
  const out: string[] = [];
  if (!input.title.trim()) out.push('La entrada necesita un título para publicarse.');
  if (!input.body.trim()) out.push('La entrada necesita contenido para publicarse.');
  if (!SLUG_RE.test(input.slug)) out.push(`Slug inválido ("${input.slug}").`);
  if (/^#\s/.test(input.body.trimStart())) out.push('El contenido empieza con un encabezado nivel 1 — usa H2/H3.');
  if (input.coverImage && /placehold\.co|placeholder\.com|via\.placeholder/i.test(input.coverImage)) {
    out.push('La portada es un placeholder externo.');
  }
  return out;
}

export async function saveBlogCmsPost(raw: unknown): Promise<ActionResult<SaveBlogCmsResult>> {
  const parsed = SaveBlogCmsPostSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos. Revisa los campos.' };
  const data: SaveBlogCmsPostInput = parsed.data;

  // Publicar/programar cambian la visibilidad pública ⇒ admin. Autosave y
  // borrador ⇒ cualquier sesión del equipo (mismo criterio que `updatePost`).
  const needsAdmin = data.intent === 'publish' || data.intent === 'schedule';
  const session = needsAdmin ? null : await requireUserSession();
  const guard = needsAdmin ? await requireAdmin(undefined, { route: `blog-cms:${data.intent}` }) : null;
  const actorId = needsAdmin ? (guard && guard.ok ? guard.uid : null) : session?.userId ?? null;
  if (!actorId) return { ok: false, error: needsAdmin ? 'Solo un administrador puede publicar o programar.' : 'No autenticado' };

  try {
    const [existing] = await db.select().from(blogPosts).where(eq(blogPosts.id, data.id)).limit(1);
    if (!existing) return { ok: false, error: 'Esta entrada ya no existe.' };

    // Categoría: la nueva gana; se crea en el catálogo si no existe.
    let category = data.category?.trim() ?? '';
    const newCategory = data.newCategory?.trim();
    if (newCategory) {
      await upsertBlogCategory(newCategory, actorId, { slug: generateSlug(newCategory) });
      category = newCategory;
    }

    // Slug: el pedido, o el del título, o uno de sistema; único en servidor.
    const baseSlug = generateSlug(data.slug) || generateSlug(data.title) || `entrada-${existing.id.slice(0, 8)}`;
    const slug = baseSlug === existing.slug ? existing.slug : await uniqueBlogSlug(baseSlug, existing.id);

    const transition = resolveSaveTransition(
      { status: existing.status, publishedAt: existing.publishedAt, scheduledAt: existing.scheduledAt },
      data.intent,
      data.scheduledAt,
      new Date(),
    );
    if (!transition.ok) return { ok: false, error: transition.error };

    const title = data.title.trim();
    const body = data.body;
    const coverImage = data.coverImage?.trim() || null;
    if (data.intent === 'publish' || data.intent === 'schedule') {
      const blockers = integrityBlockers({ title, body, slug, coverImage });
      if (blockers.length) return { ok: false, error: blockers.join(' · ') };
    }

    const tags = Array.from(new Set((data.tags ?? []).map((t) => t.trim()).filter(Boolean)));
    const faq: BlogFaqItem[] = (data.faq ?? [])
      .map((f) => ({ question: f.question.trim(), answer: f.answer.trim() }))
      .filter((f) => f.question && f.answer);
    const mapsEmbed = data.mapsEmbed ? extractMapsEmbedUrl(data.mapsEmbed) : null;
    const metaDescription = data.metaDescription.trim();
    const currentSeo = { ...EMPTY_SEO, ...(existing.seo as Record<string, unknown>) };
    const seo = {
      ...currentSeo,
      metaTitle: (data.seoTitle ?? '').trim(),
      metaDescription,
      noindex: data.noindex ?? false,
      nofollow: data.nofollow ?? false,
      ogImageAlt: (data.coverImageAlt ?? '').trim(),
    };
    const wordCount = computeWordCount(body);
    const readingTimeMin = computeReadingTime(wordCount);
    const isPublishing = transition.next.status === 'published';
    const editorial: PostEditorial = {
      ...EMPTY_EDITORIAL,
      ...(existing.editorial as Partial<PostEditorial>),
      ...(isPublishing ? { reviewerId: actorId, reviewedAt: new Date().toISOString() } : {}),
      ...(existing.status === 'published' && data.intent !== 'autosave' ? { lastReviewedAt: new Date().toISOString() } : {}),
    };
    const ai = { ...(existing.ai as Record<string, unknown>), editedByHuman: true };

    await db
      .update(blogPosts)
      .set({
        title,
        slug,
        body,
        excerpt: metaDescription,
        category,
        tags,
        faq,
        coverImage,
        mapsEmbed,
        seo,
        editorial,
        ai,
        wordCount,
        readingTimeMin,
        status: transition.next.status,
        publishedAt: transition.next.publishedAt,
        scheduledAt: transition.next.scheduledAt,
        ...(isPublishing ? { approvedBy: actorId } : {}),
        updatedAt: new Date(),
      })
      .where(eq(blogPosts.id, existing.id));

    if (data.intent !== 'autosave') {
      const actorName = await getUserDisplayName(actorId);
      const [fresh] = await db.select().from(blogPosts).where(eq(blogPosts.id, existing.id)).limit(1);
      if (fresh) {
        try {
          await snapshotPost(db, fresh, isPublishing ? 'publicacion' : 'manual', { id: actorId, name: actorName });
        } catch (err) {
          console.error('[blog-cms] snapshot falló (no bloquea):', err instanceof Error ? err.name : typeof err);
        }
      }
      const type = isPublishing ? 'publicado' : 'editado';
      const message =
        data.intent === 'publish' ? `Publicado en /blog/${slug}` :
        data.intent === 'schedule' ? `Programado para ${transition.next.scheduledAt?.toISOString()}` :
        'Borrador guardado';
      await logBlogActivity({ postId: existing.id, type, message, actorId, actorName, metadata: { intent: data.intent } });
      revalidateBlogSurfaces([slug, existing.slug !== slug ? existing.slug : null]);
    }

    return {
      ok: true,
      data: {
        slug,
        status: transition.next.status,
        publishedAt: transition.next.publishedAt?.toISOString() ?? null,
        scheduledAt: transition.next.scheduledAt?.toISOString() ?? null,
      },
    };
  } catch (err) {
    return fail(err, 'blog_cms_save_failed', 'No se pudo guardar la entrada.');
  }
}

// ── Archivar / restaurar / eliminar ─────────────────────────────────────────

async function setStatusAsAdmin(postId: string, status: 'archived' | 'draft', route: string, message: string, type: 'archivado' | 'restaurado-archivo'): Promise<ActionResult> {
  const guard = await requireAdmin(undefined, { route });
  if (!guard.ok) return { ok: false, error: guard.error };
  try {
    const row = await resolvePostRow(postId);
    if (!row) return { ok: false, error: 'Entrada no encontrada' };
    await db.update(blogPosts).set({ status, scheduledAt: null, updatedAt: new Date() }).where(eq(blogPosts.id, row.id));
    await logBlogActivity({ postId: row.id, type, message, actorId: guard.uid, actorName: await getUserDisplayName(guard.uid) });
    revalidateBlogSurfaces([row.slug]);
    return { ok: true };
  } catch (err) {
    return fail(err, 'blog_cms_status_failed', 'No se pudo cambiar el estado.');
  }
}

export async function archiveBlogCmsPost(postId: string): Promise<ActionResult> {
  return setStatusAsAdmin(postId, 'archived', 'blog-cms:archive', 'Entrada archivada', 'archivado');
}

/** Restaura a BORRADOR (no al estado previo), como Encino. */
export async function unarchiveBlogCmsPost(postId: string): Promise<ActionResult> {
  return setStatusAsAdmin(postId, 'draft', 'blog-cms:unarchive', 'Restaurada del archivo como borrador', 'restaurado-archivo');
}

/** Eliminación DEFINITIVA (Encino no tiene papelera): revisiones, actividad,
 *  redirects y contador caen en cascada por FK. */
export async function deleteBlogCmsPost(postId: string): Promise<ActionResult> {
  const guard = await requireAdmin(undefined, { route: 'blog-cms:delete' });
  if (!guard.ok) return { ok: false, error: guard.error };
  try {
    const row = await resolvePostRow(postId);
    if (!row) return { ok: false, error: 'Entrada no encontrada' };
    await db.delete(blogPosts).where(eq(blogPosts.id, row.id));
    revalidateBlogSurfaces([row.slug]);
    return { ok: true };
  } catch (err) {
    return fail(err, 'blog_cms_delete_failed', 'No se pudo eliminar la entrada.');
  }
}

// ── Revisiones ──────────────────────────────────────────────────────────────

export async function listBlogCmsRevisions(postId: string, limit = 10): Promise<ActionResult<BlogPostVersionMeta[]>> {
  const session = await requireUserSession();
  if (!session) return { ok: false, error: 'No autenticado' };
  try {
    const row = await resolvePostRow(postId);
    if (!row) return { ok: false, error: 'Entrada no encontrada' };
    const all = await listVersions(row.id);
    return { ok: true, data: all.slice(0, limit) };
  } catch (err) {
    return fail(err, 'blog_cms_versions_failed', 'No se pudieron cargar las revisiones.');
  }
}

/** Restaura contenido conservando slug/estado/fechas (semántica de Encino y
 *  del legacy `restoreVersion`); la restauración misma queda versionada. */
export async function restoreBlogCmsRevision(postId: string, versionId: string): Promise<ActionResult<{ restoredVersion: number }>> {
  const session = await requireUserSession();
  if (!session) return { ok: false, error: 'No autenticado' };
  try {
    const row = await resolvePostRow(postId);
    if (!row) return { ok: false, error: 'Entrada no encontrada' };
    const result = await restoreVersion(row.id, versionId, { id: session.userId, name: await getUserDisplayName(session.userId) });
    revalidateBlogSurfaces([row.slug]);
    return { ok: true, data: result };
  } catch (err) {
    return fail(err, 'blog_cms_restore_failed', 'No se pudo restaurar la revisión.');
  }
}

// ── Categorías ──────────────────────────────────────────────────────────────

export async function createBlogCmsCategory(raw: unknown): Promise<ActionResult<{ created: boolean }>> {
  const guard = await requireAdmin(undefined, { route: 'blog-cms:category-create' });
  if (!guard.ok) return { ok: false, error: guard.error };
  const parsed = CreateCategorySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Nombre de categoría inválido.' };
  try {
    const { name, slug, parentId, description } = parsed.data;
    const created = await upsertBlogCategory(name, guard.uid, {
      slug: slug?.trim() ? generateSlug(slug) : generateSlug(name),
      parentId: parentId ?? null,
      description: (description ?? '').trim().slice(0, 500),
    });
    if (!created) return { ok: false, error: 'Ya existe una categoría con ese nombre.' };
    revalidatePath(`${ADMIN_BLOG_PATH}/categorias`);
    return { ok: true, data: { created } };
  } catch (err) {
    return fail(err, 'blog_cms_category_failed', 'No se pudo crear la categoría.');
  }
}

export async function deleteBlogCmsCategory(id: string): Promise<ActionResult> {
  const guard = await requireAdmin(undefined, { route: 'blog-cms:category-delete' });
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: 'Categoría inválida.' };
  try {
    await deleteBlogCategory(id);
    revalidatePath(`${ADMIN_BLOG_PATH}/categorias`);
    return { ok: true };
  } catch (err) {
    return fail(err, 'blog_cms_category_delete_failed', 'No se pudo eliminar la categoría.');
  }
}
