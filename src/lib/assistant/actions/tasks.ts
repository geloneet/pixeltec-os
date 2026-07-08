'use server';

// Postgres (Drizzle) — antes Firestore `assistantTasks`.
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { sendWhatsApp } from '@/lib/whatsapp/sender';
import { db } from '@/lib/db';
import { assistantTasks, type AssistantTask } from '@/lib/db/schema';
import { resolveOwnerId, resolveTaskRow, taskRowToSerialized } from '../pg';
import {
  AssistantTaskCreateSchema,
  AssistantTaskUpdateSchema,
  AssistantTaskStatusSchema,
  AssistantPostponeSchema,
  type ActionResult,
} from '../schemas';
import { parseDateTimeToUTC, getWeekKeyFromDate, formatDateMX, formatTimeMX } from '../week-helpers';
import type { AssistantTaskSerialized, AssistantTaskStatus } from '../types';

function buildCompletionMessage(task: { title: string; category: string }): string {
  const now = new Intl.DateTimeFormat('es-MX', {
    weekday: 'short', hour: 'numeric', minute: '2-digit',
    hour12: true, timeZone: 'America/Mexico_City',
  }).format(new Date());
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pixeltec.mx';
  return [
    '✅ Tarea importante completada',
    '',
    `Tarea: ${task.title}`,
    `Categoría: ${task.category}`,
    `Completada: ${now}`,
    '',
    `${appUrl}/tareas`,
  ].join('\n');
}

const VALID_TRANSITIONS: Partial<Record<AssistantTaskStatus, AssistantTaskStatus[]>> = {
  pending:     ['in_progress', 'completed', 'cancelled', 'postponed'],
  in_progress: ['completed', 'cancelled', 'postponed'],
  postponed:   ['pending', 'in_progress', 'cancelled'],
  completed:   ['pending'],
  cancelled:   ['pending'],
};

/** Fila del task si existe y pertenece al uid; null en cualquier otro caso. */
async function getOwnedTaskRow(uid: string, taskId: string): Promise<AssistantTask | null> {
  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return null;
  const row = await resolveTaskRow(taskId);
  if (!row || row.ownerId !== ownerId) return null;
  return row;
}

export async function createTask(
  input: unknown,
): Promise<ActionResult<AssistantTaskSerialized>> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const parsed = AssistantTaskCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return { ok: false, error: 'No autenticado' };

  const { title, description, category, date, time, durationMin, important } = parsed.data;
  const startsAt = parseDateTimeToUTC(date, time);
  const weekKey  = getWeekKeyFromDate(startsAt);

  const [row] = await db
    .insert(assistantTasks)
    .values({
      ownerId,
      title,
      description: description ?? null,
      category,
      startsAt,
      durationMin,
      status:    'pending',
      weekKey,
      important: important ?? false,
    })
    .returning();

  revalidatePath('/tareas');
  return { ok: true, data: taskRowToSerialized(row, uid) };
}

export async function updateTask(
  taskId: string,
  input: unknown,
): Promise<ActionResult<AssistantTaskSerialized>> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const parsed = AssistantTaskUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  const existing = await getOwnedTaskRow(uid, taskId);
  if (!existing) return { ok: false, error: 'Tarea no encontrada' };

  const updates: Partial<typeof assistantTasks.$inferInsert> = { updatedAt: new Date() };
  const { title, description, category, date, time, durationMin, important } = parsed.data;

  if (title       !== undefined) updates.title       = title;
  if (description !== undefined) updates.description = description;
  if (category    !== undefined) updates.category    = category;
  if (durationMin !== undefined) updates.durationMin = durationMin;
  if (important   !== undefined) updates.important   = important;

  if (date !== undefined || time !== undefined) {
    const existingDate = existing.startsAt;
    const resolvedDate = date ?? formatDateMX(existingDate);
    const resolvedTime = time ?? formatTimeMX(existingDate);
    const startsAt     = parseDateTimeToUTC(resolvedDate, resolvedTime);
    updates.startsAt   = startsAt;
    updates.weekKey    = getWeekKeyFromDate(startsAt);
  }

  const [row] = await db
    .update(assistantTasks)
    .set(updates)
    .where(eq(assistantTasks.id, existing.id))
    .returning();
  if (!row) return { ok: false, error: 'Tarea no existe' };

  revalidatePath('/tareas');
  return { ok: true, data: taskRowToSerialized(row, uid) };
}

export async function setTaskStatus(
  taskId: string,
  status: unknown,
): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const parsed = AssistantTaskStatusSchema.safeParse(status);
  if (!parsed.success) return { ok: false, error: 'Estado inválido' };

  const row = await getOwnedTaskRow(uid, taskId);
  if (!row) return { ok: false, error: 'Tarea no encontrada' };

  const allowed = VALID_TRANSITIONS[row.status as AssistantTaskStatus] ?? [];
  if (!allowed.includes(parsed.data)) {
    return { ok: false, error: `No se puede pasar de ${row.status} a ${parsed.data}` };
  }

  await db
    .update(assistantTasks)
    .set({ status: parsed.data, updatedAt: new Date() })
    .where(eq(assistantTasks.id, row.id));

  // Notificación WhatsApp cuando se completa una tarea importante (best-effort)
  if (parsed.data === 'completed' && row.important) {
    sendWhatsApp(buildCompletionMessage(row)).catch((err) =>
      console.error('[tasks] completion notification failed:', err),
    );
  }

  revalidatePath('/tareas');
  return { ok: true };
}

export async function postponeTask(
  taskId: string,
  input: unknown,
): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const parsed = AssistantPostponeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  const row = await getOwnedTaskRow(uid, taskId);
  if (!row) return { ok: false, error: 'Tarea no encontrada' };

  const startsAt = parseDateTimeToUTC(parsed.data.date, parsed.data.time);
  const weekKey  = getWeekKeyFromDate(startsAt);

  await db
    .update(assistantTasks)
    .set({ startsAt, weekKey, status: 'pending', updatedAt: new Date() })
    .where(eq(assistantTasks.id, row.id));

  revalidatePath('/tareas');
  return { ok: true };
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const row = await getOwnedTaskRow(uid, taskId);
  if (!row) return { ok: false, error: 'Tarea no encontrada' };

  await db.delete(assistantTasks).where(eq(assistantTasks.id, row.id));
  revalidatePath('/tareas');
  return { ok: true };
}
