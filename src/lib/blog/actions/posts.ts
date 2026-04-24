'use server';

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAdminApp } from '@/lib/firebase-admin';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { revalidatePath } from 'next/cache';
import { BlogPostEditSchema, type BlogPostEditInput, type ActionResult } from '../schemas';
import { computeWordCount, computeReadingTime, generateSlug } from '../ai/generate-post';

function db() {
  return getFirestore(getAdminApp());
}

export async function updatePost(postId: string, input: BlogPostEditInput): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const parsed = BlogPostEditSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos inválidos' };
  }

  const { seoMetaTitle, seoMetaDescription, ...rest } = parsed.data;
  const wordCount = computeWordCount(rest.body);
  const readingTimeMin = computeReadingTime(wordCount);

  await db()
    .collection('blogPosts')
    .doc(postId)
    .update({
      ...rest,
      wordCount,
      readingTimeMin,
      'ai.editedByHuman': true,
      'seo.metaTitle': seoMetaTitle ?? rest.title.slice(0, 70),
      'seo.metaDescription': seoMetaDescription ?? rest.excerpt.slice(0, 160),
      status: 'needs-review',
      updatedAt: FieldValue.serverTimestamp(),
    });

  return { ok: true };
}

export async function approvePost(postId: string): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  await db()
    .collection('blogPosts')
    .doc(postId)
    .update({
      status: 'approved',
      approvedBy: uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

  return { ok: true };
}

export async function publishPost(postId: string): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const ref = db().collection('blogPosts').doc(postId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: 'Post no encontrado' };

  const data = snap.data();
  if (!data) return { ok: false, error: 'Datos no encontrados' };

  // Ensure slug is unique
  let slug = data.slug as string;
  if (!slug) {
    slug = generateSlug(data.title as string);
    // Check uniqueness
    const existing = await db().collection('blogPosts').where('slug', '==', slug).get();
    if (!existing.empty) {
      slug = `${slug}-${Date.now()}`;
    }
  }

  const wordCount = computeWordCount(data.body as string);
  const readingTimeMin = computeReadingTime(wordCount);

  await ref.update({
    status: 'published',
    slug,
    wordCount,
    readingTimeMin,
    publishedAt: FieldValue.serverTimestamp(),
    approvedBy: uid,
    'seo.noindex': false,
    updatedAt: FieldValue.serverTimestamp(),
  });

  revalidatePath('/blog');
  revalidatePath(`/blog/${slug}`);

  return { ok: true };
}

export async function archivePost(postId: string): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  await db()
    .collection('blogPosts')
    .doc(postId)
    .update({
      status: 'archived',
      updatedAt: FieldValue.serverTimestamp(),
    });

  return { ok: true };
}

export async function setPostStatus(
  postId: string,
  status: 'draft' | 'needs-review' | 'approved',
): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  await db()
    .collection('blogPosts')
    .doc(postId)
    .update({ status, updatedAt: FieldValue.serverTimestamp() });

  return { ok: true };
}
