// Fase 4 (rebanada Blog): Postgres/Drizzle — antes Firestore `blogPosts`.
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { blogPosts } from '@/lib/db/schema';
import type { BlogPostSerialized, BlogPostStatus } from '../types';

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
    seo: (r.seo ?? { metaTitle: '', metaDescription: '', canonicalUrl: null, noindex: true }) as BlogPostSerialized['seo'],
    wordCount: r.wordCount,
    readingTimeMin: r.readingTimeMin,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    publishedAt: r.publishedAt?.toISOString() ?? null,
    approvedBy: r.approvedBy,
  };
}

const noindexFalse = sql`(${blogPosts.seo} ->> 'noindex')::boolean = false`;

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
