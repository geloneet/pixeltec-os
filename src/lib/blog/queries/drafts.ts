// Fase 4 (rebanada Blog): Postgres — antes Firestore `blogBriefs`.
import { resolveBriefRow, publicId } from '../pg';
import type { BlogBriefSerialized } from '../types';

export async function getBriefById(briefId: string): Promise<BlogBriefSerialized | null> {
  const row = await resolveBriefRow(briefId);
  if (!row) return null;
  const d = row.data as Record<string, unknown>;
  return {
    id: publicId(row),
    topic: (d.topic as string) ?? '',
    angle: (d.angle as string) ?? '',
    targetAudience: (d.targetAudience as string) ?? '',
    keyPoints: (d.keyPoints as string[]) ?? [],
    tone: (d.tone as string) ?? 'educativo',
    status: (d.status as BlogBriefSerialized['status']) ?? 'pending',
    generatedDraftId: (d.generatedDraftId as string | null) ?? null,
    createdBy: (d.createdBy as string) ?? '',
    createdAt: row.createdAt.toISOString(),
  };
}
