'use server';

// Fase 4 (rebanada Blog): Postgres — antes Firestore `blogPosts`.
import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { blogPosts } from '@/lib/db/schema';
import { getSessionUid } from '@/lib/auth/session';
import { resolvePostRow } from '../pg';
import { BlogPostEditSchema, type BlogPostEditInput, type ActionResult } from '../schemas';
import { computeWordCount, computeReadingTime, generateSlug } from '../ai/generate-post';

export async function updatePost(postId: string, input: BlogPostEditInput): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const parsed = BlogPostEditSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos inválidos' };
  }

  const row = await resolvePostRow(postId);
  if (!row) return { ok: false, error: 'Post no encontrado' };

  const { seoMetaTitle, seoMetaDescription, ...rest } = parsed.data;
  const wordCount = computeWordCount(rest.body);
  const readingTimeMin = computeReadingTime(wordCount);
  const seo = {
    ...(row.seo as Record<string, unknown>),
    metaTitle: seoMetaTitle ?? rest.title.slice(0, 70),
    metaDescription: seoMetaDescription ?? rest.excerpt.slice(0, 160),
  };
  const ai = { ...(row.ai as Record<string, unknown>), editedByHuman: true };

  await db
    .update(blogPosts)
    .set({
      ...rest,
      wordCount,
      readingTimeMin,
      ai,
      seo,
      status: 'needs-review',
      updatedAt: new Date(),
    })
    .where(eq(blogPosts.id, row.id));

  return { ok: true };
}

export async function approvePost(postId: string): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const row = await resolvePostRow(postId);
  if (!row) return { ok: false, error: 'Post no encontrado' };

  await db
    .update(blogPosts)
    .set({ status: 'approved', approvedBy: uid, updatedAt: new Date() })
    .where(eq(blogPosts.id, row.id));

  return { ok: true };
}

export async function publishPost(postId: string): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const row = await resolvePostRow(postId);
  if (!row) return { ok: false, error: 'Post no encontrado' };

  // Ensure slug is unique
  let slug = row.slug;
  if (!slug) {
    slug = generateSlug(row.title);
    const [existing] = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(eq(blogPosts.slug, slug))
      .limit(1);
    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }
  }

  const wordCount = computeWordCount(row.body);
  const readingTimeMin = computeReadingTime(wordCount);
  const seo = { ...(row.seo as Record<string, unknown>), noindex: false };

  await db
    .update(blogPosts)
    .set({
      status: 'published',
      slug,
      wordCount,
      readingTimeMin,
      publishedAt: new Date(),
      approvedBy: uid,
      seo,
      updatedAt: new Date(),
    })
    .where(eq(blogPosts.id, row.id));

  revalidatePath('/blog');
  revalidatePath(`/blog/${slug}`);

  return { ok: true };
}

export async function archivePost(postId: string): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const row = await resolvePostRow(postId);
  if (!row) return { ok: false, error: 'Post no encontrado' };

  await db
    .update(blogPosts)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(eq(blogPosts.id, row.id));

  return { ok: true };
}

export async function setPostStatus(
  postId: string,
  status: 'draft' | 'needs-review' | 'approved',
): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const row = await resolvePostRow(postId);
  if (!row) return { ok: false, error: 'Post no encontrado' };

  await db.update(blogPosts).set({ status, updatedAt: new Date() }).where(eq(blogPosts.id, row.id));

  return { ok: true };
}
