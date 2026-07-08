'use server';

// Fase 4 (rebanada Blog): Postgres — antes Firestore `blogBriefs`/`blogPosts`.
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { blogBriefs, blogPosts } from '@/lib/db/schema';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { resolveBriefRow, resolvePostRow, publicId, getUserDisplayName } from '../pg';
import { generatePostFromBrief, computeWordCount, computeReadingTime, generateSlug } from '../ai/generate-post';
import type { BlogBriefDoc } from '../types';
import type { ActionResult } from '../schemas';

function setBriefStatus(briefRowId: string, patch: Record<string, unknown>) {
  return db
    .update(blogBriefs)
    .set({ data: sql`${blogBriefs.data} || ${JSON.stringify(patch)}::jsonb` })
    .where(eq(blogBriefs.id, briefRowId));
}

export async function generateDraft(briefId: string): Promise<ActionResult<{ postId: string }>> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const briefRow = await resolveBriefRow(briefId);
  if (!briefRow) return { ok: false, error: 'Brief no encontrado' };
  const briefFields = briefRow.data as Record<string, unknown>;

  const briefData: BlogBriefDoc = {
    id: publicId(briefRow),
    topic: (briefFields.topic as string) ?? '',
    angle: (briefFields.angle as string) ?? '',
    targetAudience: (briefFields.targetAudience as string) ?? '',
    keyPoints: (briefFields.keyPoints as string[]) ?? [],
    tone: (briefFields.tone as string) ?? '',
    status: 'pending',
    generatedDraftId: null,
    createdBy: (briefFields.createdBy as string) ?? uid,
    createdAt: briefRow.createdAt,
  };

  // Mark as generating
  await setBriefStatus(briefRow.id, { status: 'generating' });

  try {
    const authorName = await getUserDisplayName(uid);
    const generated = await generatePostFromBrief(briefData);

    const wordCount = computeWordCount(generated.body);
    const readingTimeMin = computeReadingTime(wordCount);
    const slug = generateSlug(generated.title);
    const now = new Date();

    const [postRow] = await db
      .insert(blogPosts)
      .values({
        slug,
        title: generated.title,
        excerpt: generated.excerpt,
        body: generated.body,
        category: generated.category,
        tags: generated.tags,
        coverImage: null,
        author: { name: authorName, uid },
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
          generatedAt: now.toISOString(),
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
      })
      .returning({ id: blogPosts.id });

    await setBriefStatus(briefRow.id, { status: 'generated', generatedDraftId: postRow.id });

    return { ok: true, data: { postId: postRow.id } };
  } catch (err) {
    await setBriefStatus(briefRow.id, { status: 'pending' });
    console.error('generateDraft error:', err);
    return { ok: false, error: err instanceof Error ? err.message : 'Error generando borrador' };
  }
}

export async function regenerateDraft(postId: string): Promise<ActionResult<{ postId: string }>> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const row = await resolvePostRow(postId);
  if (!row) return { ok: false, error: 'Post no encontrado' };

  const briefSource = row.briefSource as Record<string, unknown>;
  const briefLike: BlogBriefDoc = {
    id: postId,
    topic: (briefSource.topic as string) ?? '',
    angle: (briefSource.angle as string) ?? '',
    targetAudience: (briefSource.targetAudience as string) ?? '',
    keyPoints: (briefSource.keyPoints as string[]) ?? [],
    tone: (briefSource.tone as string) ?? '',
    status: 'generated',
    generatedDraftId: postId,
    createdBy: uid,
    createdAt: row.createdAt,
  };

  try {
    const generated = await generatePostFromBrief(briefLike);
    const wordCount = computeWordCount(generated.body);
    const readingTimeMin = computeReadingTime(wordCount);
    const prevAi = row.ai as Record<string, unknown>;

    await db
      .update(blogPosts)
      .set({
        body: generated.body,
        title: generated.title,
        excerpt: generated.excerpt,
        wordCount,
        readingTimeMin,
        status: 'draft',
        ai: {
          ...prevAi,
          iterations: ((prevAi.iterations as number) ?? 1) + 1,
          generatedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(blogPosts.id, row.id));

    return { ok: true, data: { postId } };
  } catch (err) {
    console.error('regenerateDraft error:', err);
    return { ok: false, error: err instanceof Error ? err.message : 'Error regenerando borrador' };
  }
}
