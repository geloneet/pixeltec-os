// Blog (WO-2026-00088, paridad Encino) — capa de lectura/escritura sobre las
// MISMAS tablas del blog legacy (D-C Opción A). Sin cliente de BD paralelo:
// todo pasa por `@/lib/db`. Las funciones son server-only por importar `db`.
import { and, count, desc, eq, ilike, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { blogCategories, blogPosts, postRedirects } from '@/lib/db/schema';
import { serializePost } from '@/lib/blog/queries/posts';
import type { BlogPostSerialized } from '@/lib/blog/types';

export type BlogCmsStatusTab = 'all' | 'published' | 'scheduled' | 'draft' | 'archived';

export const PAGE_SIZE = 20;

export interface AdminPostsFilter {
  status?: BlogCmsStatusTab;
  category?: string;
  /** `YYYY-MM` sobre coalesce(published_at, updated_at). */
  month?: string;
  search?: string;
  page?: number;
}

/** Estados «vivos» del flujo Encino. El legacy `needs-review`/`approved` se
 *  muestra en «Todas» como borradores en revisión (no se pierden). */
function statusCondition(tab: BlogCmsStatusTab | undefined) {
  switch (tab) {
    case 'published':
      return eq(blogPosts.status, 'published');
    case 'scheduled':
      return eq(blogPosts.status, 'scheduled');
    case 'draft':
      return inArray(blogPosts.status, ['draft', 'needs-review', 'approved']);
    case 'archived':
      return eq(blogPosts.status, 'archived');
    default:
      return undefined;
  }
}

const monthExpr = sql<string>`to_char(date_trunc('month', coalesce(${blogPosts.publishedAt}, ${blogPosts.updatedAt})), 'YYYY-MM')`;

function whereFor(filter: AdminPostsFilter) {
  const conds = [
    statusCondition(filter.status),
    filter.category ? eq(blogPosts.category, filter.category) : undefined,
    filter.month && /^\d{4}-\d{2}$/.test(filter.month) ? sql`${monthExpr} = ${filter.month}` : undefined,
    filter.search ? or(ilike(blogPosts.title, `%${filter.search}%`), ilike(blogPosts.slug, `%${filter.search}%`)) : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);
  return conds.length ? and(...conds) : undefined;
}

export async function listBlogCmsPosts(filter: AdminPostsFilter): Promise<{ posts: BlogPostSerialized[]; total: number }> {
  const page = Math.max(1, filter.page ?? 1);
  const where = whereFor(filter);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(blogPosts)
      .where(where)
      .orderBy(desc(blogPosts.updatedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(blogPosts).where(where),
  ]);
  return { posts: rows.map(serializePost), total: Number(total) };
}

export async function countBlogCmsPostsByStatus(): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: blogPosts.status, n: count() })
    .from(blogPosts)
    .groupBy(blogPosts.status);
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
}

export async function listBlogCmsMonths(): Promise<string[]> {
  const rows = await db
    .select({ month: monthExpr })
    .from(blogPosts)
    .groupBy(monthExpr)
    .orderBy(desc(monthExpr));
  return rows.map((r) => r.month).filter(Boolean);
}

// ── Programación (barrido en render, paridad Encino `publishDueScheduledPosts`) ──

const SCHEDULED_SWEEP_INTERVAL_MS = 60_000;
let lastScheduledSweep = 0;

/**
 * Publica los posts `scheduled` cuya fecha ya pasó. Como en Encino: se invoca
 * desde el render de las superficies públicas y del listado admin, a lo sumo
 * una vez por minuto por proceso (estado en memoria, no coordinado entre
 * réplicas). Devuelve los slugs publicados. `force` ignora el throttle (tests).
 */
export async function publishDueScheduledPosts(opts: { force?: boolean; now?: Date } = {}): Promise<string[]> {
  const nowMs = (opts.now ?? new Date()).getTime();
  if (!opts.force && nowMs - lastScheduledSweep < SCHEDULED_SWEEP_INTERVAL_MS) return [];
  lastScheduledSweep = nowMs;
  const now = opts.now ?? new Date();
  const rows = await db
    .update(blogPosts)
    .set({
      status: 'published',
      publishedAt: sql`coalesce(${blogPosts.publishedAt}, ${blogPosts.scheduledAt})`,
      scheduledAt: null,
      updatedAt: now,
    })
    .where(and(eq(blogPosts.status, 'scheduled'), lte(blogPosts.scheduledAt, now)))
    .returning({ slug: blogPosts.slug });
  return rows.map((r) => r.slug);
}

/** Solo para tests: reinicia el throttle del barrido. */
export function resetScheduledSweepThrottle(): void {
  lastScheduledSweep = 0;
}

// ── Borradores vacíos (paridad Encino `deleteAbandonedEmptyDrafts`/`deleteBlogPostIfEmpty`) ──

const EMPTY_BODY = sql`btrim(regexp_replace(${blogPosts.body}, '\\s', '', 'g')) = ''`;
const EMPTY_DRAFT = and(
  eq(blogPosts.status, 'draft'),
  sql`btrim(${blogPosts.title}) = ''`,
  EMPTY_BODY,
  isNull(blogPosts.coverImage),
);

/** Borra borradores sin título, sin cuerpo y sin portada abandonados hace más de
 *  10 minutos (las revisiones/actividad caen en cascada). Devuelve cuántos. */
export async function deleteAbandonedEmptyDrafts(): Promise<number> {
  const rows = await db
    .delete(blogPosts)
    .where(and(EMPTY_DRAFT, sql`${blogPosts.updatedAt} < now() - interval '10 minutes'`))
    .returning({ id: blogPosts.id });
  return rows.length;
}

/** Borra UN borrador si sigue vacío (al cerrar el wizard IA sin escribir). */
export async function deleteBlogPostIfEmpty(id: string): Promise<boolean> {
  const rows = await db
    .delete(blogPosts)
    .where(and(eq(blogPosts.id, id), EMPTY_DRAFT))
    .returning({ id: blogPosts.id });
  return rows.length > 0;
}

// ── Slug único (misma regla que el legacy: -2, -3…; evita redirects históricos) ──

export async function uniqueBlogSlug(base: string, excludePostId?: string): Promise<string> {
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
    if (i > 50) throw new Error('No se pudo generar una URL única.');
    candidate = `${base}-${i}`;
  }
}

// ── Categorías ──────────────────────────────────────────────────────────────

export interface BlogCategoryDto {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  parentName: string | null;
  description: string;
  postCount: number;
}

export async function listBlogCategoryNames(): Promise<string[]> {
  const rows = await db.select({ name: blogCategories.name }).from(blogCategories).orderBy(blogCategories.name);
  return rows.map((r) => r.name);
}

export async function listBlogCategoriesWithUsage(): Promise<BlogCategoryDto[]> {
  const [cats, usage] = await Promise.all([
    db.select().from(blogCategories).orderBy(blogCategories.name),
    db.select({ category: blogPosts.category, n: count() }).from(blogPosts).groupBy(blogPosts.category),
  ]);
  const byName = new Map(usage.map((u) => [u.category, Number(u.n)]));
  const byId = new Map(cats.map((c) => [c.id, c.name]));
  return cats.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    parentId: c.parentId,
    parentName: c.parentId ? (byId.get(c.parentId) ?? null) : null,
    description: c.description,
    postCount: byName.get(c.name) ?? 0,
  }));
}

/** Crea la categoría si no existe (nunca actualiza una existente, como Encino).
 *  Devuelve true solo si se creó. */
export async function upsertBlogCategory(
  name: string,
  createdBy: string | null,
  extra: { slug?: string; parentId?: string | null; description?: string } = {},
): Promise<boolean> {
  const rows = await db
    .insert(blogCategories)
    .values({
      name,
      slug: extra.slug ?? '',
      parentId: extra.parentId ?? null,
      description: extra.description ?? '',
      createdBy,
    })
    .onConflictDoNothing({ target: blogCategories.name })
    .returning({ id: blogCategories.id });
  return rows.length > 0;
}

export async function deleteBlogCategory(id: string): Promise<boolean> {
  const rows = await db.delete(blogCategories).where(eq(blogCategories.id, id)).returning({ id: blogCategories.id });
  return rows.length > 0;
}

/** Posts (título/estado/slug) de una categoría para el diálogo «N entradas». */
export async function listPostsInCategory(category: string, limit = 500): Promise<Array<{ id: string; title: string; status: string; slug: string }>> {
  const rows = await db
    .select({ id: blogPosts.id, title: blogPosts.title, status: blogPosts.status, slug: blogPosts.slug })
    .from(blogPosts)
    .where(eq(blogPosts.category, category))
    .orderBy(desc(blogPosts.updatedAt))
    .limit(limit);
  return rows;
}
