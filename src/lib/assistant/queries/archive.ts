// Postgres (Drizzle) — antes Firestore `assistantTasksArchive`.
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { assistantTasksArchive } from '@/lib/db/schema';
import { publicId, resolveOwnerId } from '../pg';
import type { AssistantTaskCategory } from '../types';

export interface ArchivedTaskSerialized {
  id:          string;
  title:       string;
  description: string | null;
  category:    AssistantTaskCategory;
  status:      string;
  startsAt:    string; // ISO
  durationMin: number;
  archivedAt:  string; // ISO
}

export async function getArchivedTasksByWeek(
  uid: string,
  weekKey: string,
): Promise<ArchivedTaskSerialized[]> {
  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return [];

  const rows = await db
    .select()
    .from(assistantTasksArchive)
    .where(
      and(eq(assistantTasksArchive.ownerId, ownerId), eq(assistantTasksArchive.weekKey, weekKey)),
    )
    .orderBy(asc(assistantTasksArchive.startsAt));

  return rows.map((row) => ({
    id:          publicId(row),
    title:       row.title,
    description: row.description,
    category:    row.category as AssistantTaskCategory,
    status:      row.status,
    startsAt:    row.startsAt.toISOString(),
    durationMin: row.durationMin,
    archivedAt:  row.archivedAt.toISOString(),
  }));
}
