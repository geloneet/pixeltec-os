'use server';

// Fase 4 (rebanada Blog): Postgres — antes Firestore `blogBriefs`.
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { blogBriefs } from '@/lib/db/schema';
import { requireUserSession } from '@/lib/auth/session';
import { resolveBriefRow, publicId, getUserDisplayName } from '../pg';
import { BlogBriefSchema, type BlogBriefInput, type ActionResult } from '../schemas';
import { generateBriefFromProblem, type AiBrief } from '../ai/generate-brief';
import { toPublicFailure } from '@/lib/errors/public-failure';

export async function createBrief(input: BlogBriefInput): Promise<ActionResult<{ briefId: string }>> {
  const session = await requireUserSession();
  if (!session) return { ok: false, error: 'No autenticado' };

  const parsed = BlogBriefSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos inválidos' };
  }

  const createdByName = await getUserDisplayName(session.userId);

  const [row] = await db
    .insert(blogBriefs)
    .values({
      data: {
        ...parsed.data,
        status: 'pending',
        generatedDraftId: null,
        createdBy: session.userId,
        createdByName,
      },
    })
    .returning({ id: blogBriefs.id });

  return { ok: true, data: { briefId: row.id } };
}

export async function listBriefs(): Promise<ActionResult<import('../types').BlogBriefSerialized[]>> {
  const session = await requireUserSession();
  if (!session) return { ok: false, error: 'No autenticado' };

  // B-PR7: `generatedDraftId` se sigue sirviendo desde el jsonb serializado
  // (compat con briefIsIdea y los ids públicos legacy). Exponer aquí el
  // vínculo real por blog_posts.brief_id exige un join inverso Y que el
  // backfill de la 0035 haya corrido en la base — hasta entonces las filas
  // viejas tendrían brief_id NULL y las Ideas se listarían mal. La lectura
  // por brief_id llega cuando el backfill corra.
  const rows = await db.select().from(blogBriefs).orderBy(desc(blogBriefs.createdAt)).limit(50);

  const briefs = rows.map((row) => {
    const d = row.data as Record<string, unknown>;
    return {
      id: publicId(row),
      topic: (d.topic as string) ?? '',
      angle: (d.angle as string) ?? '',
      targetAudience: (d.targetAudience as string) ?? '',
      keyPoints: (d.keyPoints as string[]) ?? [],
      tone: (d.tone as string) ?? '',
      status: (d.status as import('../types').BlogBriefStatus) ?? 'pending',
      generatedDraftId: (d.generatedDraftId as string | null) ?? null,
      createdBy: (d.createdBy as string) ?? '',
      createdAt: row.createdAt.toISOString(),
    } as import('../types').BlogBriefSerialized;
  });

  return { ok: true, data: briefs };
}

/** Genera el brief completo con IA a partir del problema del lector. NO
 *  persiste nada: rellena el formulario y el humano revisa/edita antes del
 *  createBrief normal. `feedback`+`previous` = regeneración dirigida. */
export async function generateBriefWithAI(
  userProblem: string,
  feedback?: string,
  previous?: Record<string, unknown>,
): Promise<ActionResult<AiBrief>> {
  const session = await requireUserSession();
  if (!session) return { ok: false, error: 'No autenticado' };

  const problem = userProblem?.trim() ?? '';
  if (problem.length < 15) {
    return { ok: false, error: 'Describe el problema del lector con más detalle (mínimo 15 caracteres).' };
  }

  try {
    const brief = await generateBriefFromProblem({
      userProblem: problem,
      feedback: feedback?.trim() || undefined,
      previous,
    });
    return { ok: true, data: brief };
  } catch (err) {
    console.error('generateBriefWithAI error:', err);
    return {
      ok: false,
      error: toPublicFailure(err, {
        code: 'blog_generate_brief_failed',
        message: 'Error generando el brief con IA',
      }).message,
    };
  }
}

export async function discardBrief(briefId: string): Promise<ActionResult> {
  const session = await requireUserSession();
  if (!session) return { ok: false, error: 'No autenticado' };

  const row = await resolveBriefRow(briefId);
  if (!row) return { ok: false, error: 'Brief no encontrado' };

  await db
    .update(blogBriefs)
    .set({ data: sql`${blogBriefs.data} || '{"status":"discarded"}'::jsonb` })
    .where(eq(blogBriefs.id, row.id));
  return { ok: true };
}
