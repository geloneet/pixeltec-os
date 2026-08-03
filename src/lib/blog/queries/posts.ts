// Fase 4 (rebanada Blog): Postgres/Drizzle — antes Firestore `blogPosts`.
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { blogPosts, postRedirects } from '@/lib/db/schema';
import {
  EMPTY_EDITORIAL,
  EMPTY_SEO,
  type BlogPostSerialized,
  type BlogPostStatus,
  type PostInternalLink,
  type PostSource,
} from '../types';

type Row = typeof blogPosts.$inferSelect;

function serializePost(r: Row): BlogPostSerialized {
  const ai = (r.ai ?? {}) as Record<string, unknown>;
  return {
    id: r.firestoreId ?? r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    body: r.body,
    category: (r.category || 'arquitectura') as BlogPostSerialized['category'],
    tags: r.tags,
    coverImage: r.coverImage,
    author: (r.author ?? { name: 'Admin', uid: '' }) as BlogPostSerialized['author'],
    status: r.status as BlogPostStatus,
    briefSource: (r.briefSource ?? { topic: '', angle: '', targetAudience: '', keyPoints: [], tone: '' }) as BlogPostSerialized['briefSource'],
    ai: {
      model: (ai.model as string) ?? '',
      generatedAt: (ai.generatedAt as string) ?? new Date().toISOString(),
      editedByHuman: (ai.editedByHuman as boolean) ?? false,
      wordsAdded: (ai.wordsAdded as number) ?? 0,
      iterations: (ai.iterations as number) ?? 1,
    },
    // NULL-safe: filas anteriores a WS2 no traen las claves nuevas — el merge
    // con los defaults canónicos garantiza el shape completo sin backfill.
    seo: { ...EMPTY_SEO, ...((r.seo ?? {}) as Partial<BlogPostSerialized['seo']>) },
    editorial: { ...EMPTY_EDITORIAL, ...((r.editorial ?? {}) as Partial<BlogPostSerialized['editorial']>) },
    sources: ((r.sources ?? []) as PostSource[]),
    internalLinks: ((r.internalLinks ?? []) as PostInternalLink[]),
    wordCount: r.wordCount,
    readingTimeMin: r.readingTimeMin,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    publishedAt: r.publishedAt?.toISOString() ?? null,
    approvedBy: r.approvedBy,
  };
}

// NULL-safe: si `seo` no trae la clave `noindex`, `->>` devuelve NULL y la
// comparación directa con false también da NULL — la fila published
// desaparecía de listado, sitemap y detalle. El gate real de visibilidad es
// status='published'; la clave ausente cuenta como indexable.
const noindexFalse = sql`coalesce((${blogPosts.seo} ->> 'noindex')::boolean, false) = false`;

export async function getPublishedPosts(): Promise<BlogPostSerialized[]> {
  const rows = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.status, 'published'), noindexFalse))
    .orderBy(desc(blogPosts.publishedAt));
  return rows.map(serializePost);
}

export async function getPublishedPostBySlug(slug: string): Promise<BlogPostSerialized | null> {
  const [row] = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, 'published'), noindexFalse))
    .limit(1);
  return row ? serializePost(row) : null;
}

// ⚠️ A diferencia de getPublishedPostBySlug, NO filtra noindex: es para usos
// administrativos. No usar en rutas públicas.
export async function getPostBySlug(slug: string): Promise<BlogPostSerialized | null> {
  const [row] = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, 'published')))
    .limit(1);
  return row ? serializePost(row) : null;
}

export async function getPostById(postId: string): Promise<BlogPostSerialized | null> {
  // `postId` puede ser el id viejo de Firestore (rutas existentes) o el uuid.
  const [row] = await db.select().from(blogPosts).where(eq(blogPosts.firestoreId, postId)).limit(1);
  if (row) return serializePost(row);
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId);
  if (!isUuid) return null;
  const [byId] = await db.select().from(blogPosts).where(eq(blogPosts.id, postId)).limit(1);
  return byId ? serializePost(byId) : null;
}

export async function listAllPosts(statusFilter?: BlogPostStatus[]): Promise<BlogPostSerialized[]> {
  const rows = await db
    .select()
    .from(blogPosts)
    .where(statusFilter && statusFilter.length > 0 ? inArray(blogPosts.status, statusFilter) : undefined)
    .orderBy(desc(blogPosts.createdAt))
    .limit(100);
  return rows.map(serializePost);
}

/** Resuelve un slug histórico a su slug vigente (redirect 301 del artículo).
 *  Devuelve null si el slug no es un redirect conocido. */
export async function getRedirectTargetSlug(fromSlug: string): Promise<string | null> {
  const [row] = await db
    .select({ slug: blogPosts.slug })
    .from(postRedirects)
    .innerJoin(blogPosts, eq(postRedirects.postId, blogPosts.id))
    .where(eq(postRedirects.fromSlug, fromSlug))
    .limit(1);
  return row?.slug ?? null;
}

/** Posts publicados relacionados por categoría (para el bloque "Sigue
 *  leyendo" del artículo). Excluye el post actual; completa con recientes si
 *  la categoría no alcanza. */
export async function getRelatedPosts(slug: string, category: string, limit = 3): Promise<BlogPostSerialized[]> {
  const rows = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.status, 'published'), noindexFalse, sql`${blogPosts.slug} <> ${slug}`))
    .orderBy(sql`(${blogPosts.category} = ${category}) DESC`, desc(blogPosts.publishedAt))
    .limit(limit);
  return rows.map(serializePost);
}
