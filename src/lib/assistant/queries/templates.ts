// Postgres (Drizzle) — antes Firestore `assistantTemplates`.
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { assistantTemplates } from '@/lib/db/schema';
import { resolveOwnerId, resolveTemplateRow, templateRowToSerialized } from '../pg';
import type { AssistantTemplateSerialized } from '../types';

export async function getTemplates(
  uid: string,
  opts?: { activeOnly?: boolean },
): Promise<AssistantTemplateSerialized[]> {
  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return [];

  const where = opts?.activeOnly
    ? and(eq(assistantTemplates.ownerId, ownerId), eq(assistantTemplates.active, true))
    : eq(assistantTemplates.ownerId, ownerId);

  const rows = await db
    .select()
    .from(assistantTemplates)
    .where(where)
    .orderBy(desc(assistantTemplates.createdAt));

  return rows.map((row) => templateRowToSerialized(row, uid));
}

export async function getTemplateById(
  uid: string,
  id: string,
): Promise<AssistantTemplateSerialized | null> {
  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return null;

  const row = await resolveTemplateRow(id);
  if (!row || row.ownerId !== ownerId) return null;
  return templateRowToSerialized(row, uid);
}
