'use server';

// Fase 4 (rebanada Blog): Postgres — antes Firestore `blogBriefs`/`blogPosts`.
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { blogBriefs, blogPosts } from '@/lib/db/schema';
import { requireUserSession } from '@/lib/auth/session';
import { resolveBriefRow, resolvePostRow, publicId, getUserDisplayName } from '../pg';
import { generatePostFromBrief, computeWordCount, computeReadingTime, generateSlug } from '../ai/generate-post';
import { EMPTY_EDITORIAL, type BlogBriefDoc } from '../types';
import type { ActionResult } from '../schemas';
import { toPublicFailure } from '@/lib/errors/public-failure';
import { logBlogActivity } from '../activity';
import { snapshotPost } from '../versions';

function setBriefStatus(briefRowId: string, patch: Record<string, unknown>) {
  return db
    .update(blogBriefs)
    .set({ data: sql`${blogBriefs.data} || ${JSON.stringify(patch)}::jsonb` })
    .where(eq(blogBriefs.id, briefRowId));
}

export async function generateDraft(briefId: string): Promise<ActionResult<{ postId: string }>> {
  const session = await requireUserSession();
  if (!session) return { ok: false, error: 'No autenticado' };
  return generateDraftForUser(briefId, session.userId);
}

/**
 * Núcleo de la generación SIN acceso a request-scope (ni cookies ni headers):
 * la ruta asíncrona (Fase B) lo ejecuta como promesa desanclada que sigue viva
 * después de responder — cualquier `headers()`/`auth()` aquí explotaría fuera
 * del scope de la request.
 */
async function generateDraftForUser(briefId: string, userId: string): Promise<ActionResult<{ postId: string }>> {
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
    createdBy: (briefFields.createdBy as string) ?? userId,
    createdAt: briefRow.createdAt,
  };

  // Mark as generating
  await setBriefStatus(briefRow.id, { status: 'generating' });

  try {
    const authorName = await getUserDisplayName(userId);
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
        author: { name: authorName, uid: userId },
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
          // SIN truncado silencioso (SEO-BLOG-020): el corte a 70 producía
          // titles rotos a media palabra en <title> (caso real "…atien").
          // Se guarda completo; el gate advierte los largos y el humano decide.
          metaTitle: generated.title,
          metaDescription: generated.excerpt,
          canonicalUrl: null,
          noindex: true,
          primaryKeyword: briefData.primaryKeyword,
          secondaryKeywords: briefData.secondaryKeywords,
          searchIntent: briefData.searchIntent,
          contentPillar: briefData.contentPillar,
          // Alt de portada por defecto = metatítulo (decisión de Miguel
          // 2026-08-04); editable después en el editor o al elegir de Unsplash.
          ogImageAlt: generated.title,
        },
        // El revisor por defecto es quien crea el brief (operación
        // unipersonal); approvePost lo reescribe con el aprobador real.
        editorial: { ...EMPTY_EDITORIAL, reviewerId: userId },
        sources: briefData.sources ?? [],
        internalLinks: (briefData.internalLinkTargets ?? []).map((l) => ({
          targetUrl: l.url,
          anchor: l.suggestedAnchor || l.purpose || l.url,
          placement: l.purpose,
          // Los targets vienen filtrados contra la lista de rutas REALES del
          // sitio (generate-brief): su existencia está garantizada por máquina.
          verified: true,
        })),
        wordCount,
        readingTimeMin,
        // B-PR7: vínculo REAL brief→post por FK (uuid de blog_briefs).
        briefId: briefRow.id,
        publishedAt: null,
        approvedBy: null,
      })
      .returning({ id: blogPosts.id });

    // B-PR7: `data.generatedDraftId` se SIGUE escribiendo por compatibilidad —
    // la UI de Ideas (briefIsIdea/listBriefs) lee el vínculo serializado del
    // jsonb; la lectura por brief_id llega cuando el backfill de la 0035
    // corra en la base.
    await setBriefStatus(briefRow.id, { status: 'generated', generatedDraftId: postRow.id });

    await logBlogActivity({
      postId: postRow.id,
      type: 'generado-ia',
      message: `Borrador generado con IA desde el brief «${briefData.topic ?? ''}»`.trim(),
      actorId: userId,
      actorName: authorName,
      metadata: { briefId: publicId(briefRow) },
    });

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

/**
 * Fase B — generación ASÍNCRONA: marca `generating` y dispara la generación
 * SIN await; la respuesta vuelve de inmediato (evita el techo ~100s de
 * Cloudflare que mataba la conexión aunque el draft sí se creara).
 *
 * Riesgo documentado y aceptado: la promesa desanclada muere si el contenedor
 * se recicla a media generación → el brief queda en `generating`. Mitigación:
 * la UI aplica tope de espera y su botón Reintentar re-dispara con
 * `force: true`, que ignora el candado de idempotencia.
 */
export async function startDraftGeneration(
  briefId: string,
  opts?: { force?: boolean }
): Promise<ActionResult<{ started: true }>> {
  const session = await requireUserSession();
  if (!session) return { ok: false, error: 'No autenticado' };

  const briefRow = await resolveBriefRow(briefId);
  if (!briefRow) return { ok: false, error: 'Brief no encontrado' };

  const currentStatus = (briefRow.data as Record<string, unknown>).status;
  if (currentStatus === 'generating' && !opts?.force) {
    // Idempotente: ya hay una generación en curso — no la duplicamos.
    return { ok: true, data: { started: true } };
  }

  await setBriefStatus(briefRow.id, { status: 'generating', lastError: null });

  const userId = session.userId;
  void generateDraftForUser(briefId, userId)
    .then((result) => {
      // generateDraftForUser ya dejó el status en pending y saneó el error;
      // aquí solo lo persistimos para que el polling se lo muestre al editor.
      if (!result.ok) {
        return setBriefStatus(briefRow.id, {
          status: 'pending',
          lastError: result.error ?? 'Error generando borrador',
        });
      }
    })
    .catch(async (err) => {
      console.error('startDraftGeneration detached error:', err);
      await setBriefStatus(briefRow.id, {
        status: 'pending',
        lastError: toPublicFailure(err, {
          code: 'blog_generate_draft_failed',
          message: 'Error generando borrador',
        }).message,
      }).catch(() => undefined);
    });

  return { ok: true, data: { started: true } };
}

export interface BriefGenerationStatus {
  status: string;
  generatedDraftId: string | null;
  lastError: string | null;
}

/** Polling de la UI (Fase B): estado actual de la generación del brief. */
export async function getBriefGenerationStatus(
  briefId: string
): Promise<ActionResult<BriefGenerationStatus>> {
  const session = await requireUserSession();
  if (!session) return { ok: false, error: 'No autenticado' };

  const briefRow = await resolveBriefRow(briefId);
  if (!briefRow) return { ok: false, error: 'Brief no encontrado' };

  const d = briefRow.data as Record<string, unknown>;
  return {
    ok: true,
    data: {
      status: (d.status as string) ?? 'pending',
      generatedDraftId: (d.generatedDraftId as string) ?? null,
      lastError: (d.lastError as string) ?? null,
    },
  };
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
    const actorName = await getUserDisplayName(session.userId);

    // B-PR6: snapshot `pre-regeneracion-ia` ANTES de sobrescribir, en la MISMA
    // transacción que el update — regenerar ya no destruye la versión anterior
    // (el bug: sin snapshot previo se perdían cuerpo, fuentes y estrategia).
    // Fail-closed a propósito: si el snapshot no puede guardarse (p. ej. la
    // 0034 aún sin aplicar), NO se sobrescribe nada.
    await db.transaction(async (tx) => {
      await snapshotPost(tx, row, 'pre-regeneracion-ia', {
        id: session.userId,
        name: actorName,
      });
      await tx
        .update(blogPosts)
        .set({
          body: generated.body,
          title: generated.title,
          excerpt: generated.excerpt,
          wordCount,
          readingTimeMin,
          // B-PR6: se MANTIENE el status actual — antes esto forzaba
          // status:'draft' y un artículo en needs-review volvía a borrador sin
          // que nadie lo pidiera. El flujo editorial solo cambia por actos
          // explícitos (request-review/approve/…).
          ai: {
            ...prevAi,
            iterations: ((prevAi.iterations as number) ?? 1) + 1,
            generatedAt: new Date().toISOString(),
          },
          updatedAt: new Date(),
        })
        .where(eq(blogPosts.id, row.id));
    });

    await logBlogActivity({
      postId: row.id,
      type: 'regenerado-ia',
      message: 'Artículo regenerado con IA (título, extracto y cuerpo sobrescritos)',
      actorId: session.userId,
      actorName,
    });

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
