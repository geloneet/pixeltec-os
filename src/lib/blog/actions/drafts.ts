'use server';

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAdminApp, getAdminAuth } from '@/lib/firebase-admin';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { generatePostFromBrief, computeWordCount, computeReadingTime, generateSlug } from '../ai/generate-post';
import type { BlogBriefDoc, BlogPostDoc } from '../types';
import type { ActionResult } from '../schemas';

function db() {
  return getFirestore(getAdminApp());
}

export async function generateDraft(briefId: string): Promise<ActionResult<{ postId: string }>> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const briefRef = db().collection('blogBriefs').doc(briefId);
  const briefSnap = await briefRef.get();

  if (!briefSnap.exists) return { ok: false, error: 'Brief no encontrado' };

  const briefData = { id: briefSnap.id, ...briefSnap.data() } as BlogBriefDoc;

  // Mark as generating
  await briefRef.update({ status: 'generating' });

  try {
    const authUser = await getAdminAuth().getUser(uid);
    const generated = await generatePostFromBrief(briefData);

    const wordCount = computeWordCount(generated.body);
    const readingTimeMin = computeReadingTime(wordCount);
    const slug = generateSlug(generated.title);

    const postRef = db().collection('blogPosts').doc();
    const now = FieldValue.serverTimestamp();

    const postData: Omit<BlogPostDoc, 'id' | 'createdAt' | 'updatedAt' | 'ai'> & {
      ai: Omit<BlogPostDoc['ai'], 'generatedAt'> & { generatedAt: ReturnType<typeof FieldValue.serverTimestamp> };
      createdAt: ReturnType<typeof FieldValue.serverTimestamp>;
      updatedAt: ReturnType<typeof FieldValue.serverTimestamp>;
    } = {
      slug,
      title: generated.title,
      excerpt: generated.excerpt,
      body: generated.body,
      category: generated.category as BlogPostDoc['category'],
      tags: generated.tags,
      coverImage: null,
      author: { name: authUser.displayName ?? 'Admin', uid },
      status: 'draft',
      briefSource: {
        topic: briefData.topic,
        angle: briefData.angle,
        targetAudience: briefData.targetAudience,
        keyPoints: briefData.keyPoints,
        tone: briefData.tone,
      },
      ai: {
        model: process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-7',
        generatedAt: now,
        editedByHuman: false,
        wordsAdded: 0,
        iterations: 1,
      },
      seo: {
        metaTitle: generated.title.slice(0, 70),
        metaDescription: generated.excerpt.slice(0, 160),
        canonicalUrl: null,
        noindex: true,
      },
      wordCount,
      readingTimeMin,
      publishedAt: null,
      approvedBy: null,
      createdAt: now,
      updatedAt: now,
    };

    await postRef.set(postData);
    await briefRef.update({ status: 'generated', generatedDraftId: postRef.id });

    return { ok: true, data: { postId: postRef.id } };
  } catch (err) {
    await briefRef.update({ status: 'pending' });
    console.error('generateDraft error:', err);
    return { ok: false, error: err instanceof Error ? err.message : 'Error generando borrador' };
  }
}

export async function regenerateDraft(postId: string): Promise<ActionResult<{ postId: string }>> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const postRef = db().collection('blogPosts').doc(postId);
  const postSnap = await postRef.get();
  if (!postSnap.exists) return { ok: false, error: 'Post no encontrado' };

  const postData = postSnap.data() as BlogPostDoc;
  const briefLike: BlogBriefDoc = {
    id: postId,
    topic: postData.briefSource.topic,
    angle: postData.briefSource.angle,
    targetAudience: postData.briefSource.targetAudience,
    keyPoints: postData.briefSource.keyPoints,
    tone: postData.briefSource.tone,
    status: 'generated',
    generatedDraftId: postId,
    createdBy: uid,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createdAt: postData.createdAt as any,
  };

  try {
    const generated = await generatePostFromBrief(briefLike);
    const wordCount = computeWordCount(generated.body);
    const readingTimeMin = computeReadingTime(wordCount);

    await postRef.update({
      body: generated.body,
      title: generated.title,
      excerpt: generated.excerpt,
      wordCount,
      readingTimeMin,
      status: 'draft',
      'ai.iterations': (postData.ai?.iterations ?? 1) + 1,
      'ai.generatedAt': FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { ok: true, data: { postId } };
  } catch (err) {
    console.error('regenerateDraft error:', err);
    return { ok: false, error: err instanceof Error ? err.message : 'Error regenerando borrador' };
  }
}
