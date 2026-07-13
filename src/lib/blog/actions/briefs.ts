'use server';

// Fase 4 (rebanada Blog): Postgres — antes Firestore `blogBriefs`.
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { blogBriefs } from '@/lib/db/schema';
import { getSessionUid } from '@/lib/auth/session';
import { resolveBriefRow, publicId, getUserDisplayName } from '../pg';
import { BlogBriefSchema, type BlogBriefInput, type ActionResult } from '../schemas';

export async function createBrief(input: BlogBriefInput): Promise<ActionResult<{ briefId: string }>> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const parsed = BlogBriefSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos inválidos' };
  }

  const createdByName = await getUserDisplayName(uid);

  const [row] = await db
    .insert(blogBriefs)
    .values({
      data: {
        ...parsed.data,
        status: 'pending',
        generatedDraftId: null,
        createdBy: uid,
        createdByName,
      },
    })
    .returning({ id: blogBriefs.id });

  return { ok: true, data: { briefId: row.id } };
}

export async function listBriefs(): Promise<ActionResult<import('../types').BlogBriefSerialized[]>> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

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

export async function discardBrief(briefId: string): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const row = await resolveBriefRow(briefId);
  if (!row) return { ok: false, error: 'Brief no encontrado' };

  await db
    .update(blogBriefs)
    .set({ data: sql`${blogBriefs.data} || '{"status":"discarded"}'::jsonb` })
    .where(eq(blogBriefs.id, row.id));
  return { ok: true };
}
