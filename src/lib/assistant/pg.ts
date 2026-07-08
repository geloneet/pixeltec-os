// Helpers compartidos de la capa Postgres del Asistente (planner semanal).
//
// Mismo patrón que src/lib/blog/pg.ts: los ids públicos que circulan en la
// UI son los ids originales de Firestore para filas migradas y uuids de
// Postgres para las nuevas — estas funciones resuelven ambos. Los `uid` que
// fluyen por el módulo son FIREBASE UIDs (getSessionUid() /
// ASSISTANT_OWNER_UID) y se resuelven aquí a users.id (ownerId).
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  assistantTasks,
  assistantTemplates,
  assistantWeeklyReports,
  users,
  type AssistantTask,
  type AssistantTemplate,
  type AssistantWeeklyReport,
} from '@/lib/db/schema';
import type {
  AssistantTaskCategory,
  AssistantTaskSerialized,
  AssistantTaskStatus,
  AssistantTemplateSerialized,
  AssistantWeeklyReportSerialized,
  ReportTotals,
} from './types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Firebase UID (o users.id durante la transición) → users.id de Postgres. */
export async function resolveOwnerId(uid: string): Promise<string | null> {
  const [byFb] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.firebaseUid, uid))
    .limit(1);
  if (byFb) return byFb.id;
  if (!UUID_RE.test(uid)) return null;
  const [byId] = await db.select({ id: users.id }).from(users).where(eq(users.id, uid)).limit(1);
  return byId?.id ?? null;
}

export async function resolveTaskRow(taskId: string): Promise<AssistantTask | null> {
  const [byFs] = await db
    .select()
    .from(assistantTasks)
    .where(eq(assistantTasks.firestoreId, taskId))
    .limit(1);
  if (byFs) return byFs;
  if (!UUID_RE.test(taskId)) return null;
  const [byId] = await db.select().from(assistantTasks).where(eq(assistantTasks.id, taskId)).limit(1);
  return byId ?? null;
}

export async function resolveTemplateRow(templateId: string): Promise<AssistantTemplate | null> {
  const [byFs] = await db
    .select()
    .from(assistantTemplates)
    .where(eq(assistantTemplates.firestoreId, templateId))
    .limit(1);
  if (byFs) return byFs;
  if (!UUID_RE.test(templateId)) return null;
  const [byId] = await db
    .select()
    .from(assistantTemplates)
    .where(eq(assistantTemplates.id, templateId))
    .limit(1);
  return byId ?? null;
}

/** Public id: prefer the original Firestore id for migrated rows. */
export function publicId(row: { id: string; firestoreId: string | null }): string {
  return row.firestoreId ?? row.id;
}

// ── Row → Serialized (mismo shape que devolvían los serializers de types.ts) ─

export function taskRowToSerialized(row: AssistantTask, uid: string): AssistantTaskSerialized {
  return {
    id:          publicId(row),
    uid,
    title:       row.title,
    description: row.description,
    category:    row.category as AssistantTaskCategory,
    startsAt:    row.startsAt.toISOString(),
    durationMin: row.durationMin,
    status:      row.status as AssistantTaskStatus,
    weekKey:     row.weekKey,
    templateId:  row.templateId ?? null,
    important:   row.important ?? false,
    createdAt:   row.createdAt.toISOString(),
    updatedAt:   row.updatedAt.toISOString(),
  };
}

export function templateRowToSerialized(
  row: AssistantTemplate,
  uid: string,
): AssistantTemplateSerialized {
  return {
    id:          publicId(row),
    uid,
    title:       row.title,
    description: row.description,
    category:    row.category as AssistantTaskCategory,
    rrule:       row.rrule,
    defaultTime: row.defaultTime,
    durationMin: row.durationMin,
    active:      row.active,
    createdAt:   row.createdAt.toISOString(),
    updatedAt:   row.updatedAt.toISOString(),
  };
}

export function reportRowToSerialized(
  row: AssistantWeeklyReport,
  uid: string,
): AssistantWeeklyReportSerialized {
  return {
    // El doc id de Firestore era `${uid}_${weekKey}` — se preserva ese
    // formato como id público para las filas nuevas también.
    id:                row.firestoreId ?? `${uid}_${row.weekKey}`,
    uid,
    weekKey:           row.weekKey,
    weekStart:         row.weekStart.toISOString(),
    weekEnd:           row.weekEnd.toISOString(),
    totals:            row.totals as ReportTotals,
    byCategory:        row.byCategory as Record<AssistantTaskCategory, ReportTotals>,
    generatedAt:       row.generatedAt.toISOString(),
    generatedBy:       row.generatedBy as 'cron' | 'manual',
    whatsappMessageId: row.whatsappMessageId,
    whatsappSentAt:    row.whatsappSentAt?.toISOString() ?? null,
    whatsappError:     row.whatsappError,
    telegramMessageId: row.telegramMessageId,
    telegramSentAt:    row.telegramSentAt?.toISOString() ?? null,
    emailSentAt:       row.emailSentAt?.toISOString() ?? null,
  };
}
