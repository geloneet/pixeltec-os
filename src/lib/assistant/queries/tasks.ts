// Postgres (Drizzle) — antes Firestore `assistantTasks`.
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { assistantTasks } from '@/lib/db/schema';
import { resolveOwnerId, resolveTaskRow, taskRowToSerialized } from '../pg';
import type { AssistantTaskSerialized } from '../types';
import { getCurrentWeekKey } from '../week-helpers';

export async function getCurrentWeekTasks(uid: string): Promise<AssistantTaskSerialized[]> {
  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return [];

  const weekKey = getCurrentWeekKey();
  const rows = await db
    .select()
    .from(assistantTasks)
    .where(and(eq(assistantTasks.ownerId, ownerId), eq(assistantTasks.weekKey, weekKey)))
    .orderBy(asc(assistantTasks.startsAt));

  return rows.map((row) => taskRowToSerialized(row, uid));
}

export async function getTaskById(
  uid: string,
  taskId: string,
): Promise<AssistantTaskSerialized | null> {
  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return null;

  const row = await resolveTaskRow(taskId);
  if (!row || row.ownerId !== ownerId) return null;
  return taskRowToSerialized(row, uid);
}
