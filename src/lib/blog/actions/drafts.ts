'use server';

// Fase 4 (rebanada Blog): Postgres — antes Firestore `blogBriefs`/`blogPosts`.
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { blogBriefs, blogPosts } from '@/lib/db/schema';
import { requireUserSession } from '@/lib/auth/session';
import { resolveBriefRow, resolvePostRow, publicId, getUserDisplayName } from '../pg';
import { generatePostFromBrief, computeWordCount, computeReadingTime, generateSlug } from '../ai/generate-post';
import type { BlogBriefDoc } from '../types';
import type { ActionResult } from '../schemas';
import { toPublicFailure } from '@/lib/errors/public-failure';

function setBriefStatus(briefRowId: string, patch: Record<string, unknown>) {
  return db
    .update(blogBriefs)
    .set({ data: sql`${blogBriefs.data} || ${JSON.stringify(patch)}::jsonb` })
    .where(eq(blogBriefs.id, briefRowId));
}

export async function generateDraft(briefId: string): Promise<ActionResult<{ postId: string }>> {
  const session = await requireUserSession();
  if (!session) return { ok: false, error: 'No autenticado' };

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
    // Estrategia WS2 (opcional en briefs viejos — defaults vacíos)
    userProblem: (briefFields.userProblem as string) ?? '',
    searchIntent: (briefFields.searchIntent as BlogBriefDoc['searchIntent']) ?? '',
    primaryKeyword: (briefFields.primaryKeyword as string) ?? '',
    secondaryKeywords: (briefFields.secondaryKeywords as string[]) ?? [],
    entities: (briefFields.entities as string[]) ?? [],
    contentPillar: (briefFields.contentPillar as string) ?? '',
    funnelStage: (briefFields.funnelStage as BlogBriefDoc['funnelStage']) ?? '',
    contentGoal: (briefFields.contentGoal as string) ?? '',
    desiredAction: (briefFields.desiredAction as string) ?? '',
    pixeltecExperience: (briefFields.pixeltecExperience as string[]) ?? [],
    internalLinkTargets: (briefFields.internalLinkTargets as BlogBriefDoc['internalLinkTargets']) ?? [],
    sources: (briefFields.sources as BlogBriefDoc['sources']) ?? [],
    status: 'pending',
    generatedDraftId: null,
    createdBy: (briefFields.createdBy as string) ?? session.userId,
    createdAt: briefRow.createdAt,
  };

  // Mark as generating
  await setBriefStatus(briefRow.id, { status: 'generating' });

  try {
    const authorName = await getUserDisplayName(session.userId);
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
        author: { name: authorName, uid: session.userId },
        status: 'draft',
        briefSource: {
          topic: briefData.topic,
          angle: briefData.angle,
          targetAudience: briefData.targetAudience,
          keyPoints: briefData.keyPoints,
          tone: briefData.tone,
          userProblem: briefData.userProblem,
          searchIntent: briefData.searchIntent,
          primaryKeyword: briefData.primaryKeyword,
          secondaryKeywords: briefData.secondaryKeywords,
          entities: briefData.entities,
          contentPillar: briefData.contentPillar,
          funnelStage: briefData.funnelStage,
          contentGoal: briefData.contentGoal,
          desiredAction: briefData.desiredAction,
          pixeltecExperience: briefData.pixeltecExperience,
          internalLinkTargets: briefData.internalLinkTargets,
        },
        ai: {
          // Modelo REAL del response (no la env var) + output crudo para
          // auditoría de la generación.
          model: generated.modelUsed,
          generatedAt: now.toISOString(),
          editedByHuman: false,
          wordsAdded: 0,
          iterations: 1,
          rawOutput: generated.rawOutput,
        },
        seo: {
          metaTitle: generated.title.slice(0, 70),
          metaDescription: generated.excerpt.slice(0, 160),
          canonicalUrl: null,
          noindex: true,
          primaryKeyword: briefData.primaryKeyword,
          secondaryKeywords: briefData.secondaryKeywords,
          searchIntent: briefData.searchIntent,
          contentPillar: briefData.contentPillar,
          ogImageAlt: '',
        },
        sources: briefData.sources ?? [],
        internalLinks: (briefData.internalLinkTargets ?? []).map((l) => ({
          targetUrl: l.url,
          anchor: l.suggestedAnchor || l.purpose || l.url,
          placement: l.purpose,
          verified: false,
        })),
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
    // Los adaptadores de IA ya sanean lo suyo, pero esta Action no puede
    // apoyarse en esa garantía para cualquier `Error` futuro: un
    // `AiProviderError` o un fallo de Drizzle citarían el cuerpo del proveedor
    // o la consulta, y el editor los muestra tal cual con `toast.error`.
    return {
      ok: false,
      error: toPublicFailure(err, {
        code: 'blog_generate_draft_failed',
        message: 'Error generando borrador',
      }).message,
    };
  }
}

export async function regenerateDraft(postId: string): Promise<ActionResult<{ postId: string }>> {
  const session = await requireUserSession();
  if (!session) return { ok: false, error: 'No autenticado' };

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
    createdBy: session.userId,
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
    return {
      ok: false,
      error: toPublicFailure(err, {
        code: 'blog_regenerate_draft_failed',
        message: 'Error regenerando borrador',
      }).message,
    };
  }
}
