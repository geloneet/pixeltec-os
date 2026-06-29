'use server';

import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { sendWhatsApp } from '@/lib/whatsapp/sender';
import { db, COL } from '../firebase-admin';
import {
  AssistantTaskCreateSchema,
  AssistantTaskUpdateSchema,
  AssistantTaskStatusSchema,
  AssistantPostponeSchema,
  type ActionResult,
} from '../schemas';
import { parseDateTimeToUTC, getWeekKeyFromDate, formatDateMX, formatTimeMX } from '../week-helpers';
import {
  serializeTask,
  type AssistantTaskDoc,
  type AssistantTaskSerialized,
  type AssistantTaskStatus,
} from '../types';

function buildCompletionMessage(task: AssistantTaskDoc): string {
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

async function verifyOwnership(uid: string, taskId: string): Promise<boolean> {
  const doc = await db().collection(COL.assistantTasks).doc(taskId).get();
  if (!doc.exists) return false;
  return (doc.data() as AssistantTaskDoc).uid === uid;
}

export async function createTask(
  input: unknown,
): Promise<ActionResult<AssistantTaskSerialized>> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const parsed = AssistantTaskCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  const { title, description, category, date, time, durationMin, important } = parsed.data;
  const startsAt = parseDateTimeToUTC(date, time);
  const weekKey  = getWeekKeyFromDate(startsAt);
  const now      = FieldValue.serverTimestamp();

  const ref = await db().collection(COL.assistantTasks).add({
    uid,
    title,
    description:  description ?? null,
    category,
    startsAt,
    durationMin,
    status:    'pending',
    weekKey,
    important: important ?? false,
    createdAt: now,
    updatedAt: now,
  });

  // Re-read para obtener timestamps server-resolved (serverTimestamp()
  // se resuelve en el write, no antes).
  const snap = await ref.get();
  const serialized = serializeTask(snap.data() as AssistantTaskDoc, ref.id);

  revalidatePath('/tareas');
  return { ok: true, data: serialized };
}

export async function updateTask(
  taskId: string,
  input: unknown,
): Promise<ActionResult<AssistantTaskSerialized>> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const parsed = AssistantTaskUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  const owns = await verifyOwnership(uid, taskId);
  if (!owns) return { ok: false, error: 'Tarea no encontrada' };

  const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  const { title, description, category, date, time, durationMin, important } = parsed.data;

  if (title       !== undefined) updates.title       = title;
  if (description !== undefined) updates.description = description;
  if (category    !== undefined) updates.category    = category;
  if (durationMin !== undefined) updates.durationMin = durationMin;
  if (important   !== undefined) updates.important   = important;

  if (date !== undefined || time !== undefined) {
    const doc = await db().collection(COL.assistantTasks).doc(taskId).get();
    const existing = doc.data() as AssistantTaskDoc;
    const existingDate = existing.startsAt.toDate();
    const resolvedDate = date ?? formatDateMX(existingDate);
    const resolvedTime = time ?? formatTimeMX(existingDate);
    const startsAt     = parseDateTimeToUTC(resolvedDate, resolvedTime);
    updates.startsAt   = startsAt;
    updates.weekKey    = getWeekKeyFromDate(startsAt);
  }

  await db().collection(COL.assistantTasks).doc(taskId).update(updates);

  // Re-read post-update: timestamps y campos derivados ya resueltos.
  const snap = await db().collection(COL.assistantTasks).doc(taskId).get();
  if (!snap.exists) return { ok: false, error: 'Tarea no existe' };
  const serialized = serializeTask(snap.data() as AssistantTaskDoc, taskId);

  revalidatePath('/tareas');
  return { ok: true, data: serialized };
}

export async function setTaskStatus(
  taskId: string,
  status: unknown,
): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const parsed = AssistantTaskStatusSchema.safeParse(status);
  if (!parsed.success) return { ok: false, error: 'Estado inválido' };

  const doc = await db().collection(COL.assistantTasks).doc(taskId).get();
  if (!doc.exists) return { ok: false, error: 'Tarea no encontrada' };

  const data = doc.data() as AssistantTaskDoc;
  if (data.uid !== uid) return { ok: false, error: 'Tarea no encontrada' };

  const allowed = VALID_TRANSITIONS[data.status] ?? [];
  if (!allowed.includes(parsed.data)) {
    return { ok: false, error: `No se puede pasar de ${data.status} a ${parsed.data}` };
  }

  await db().collection(COL.assistantTasks).doc(taskId).update({
    status:    parsed.data,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Notificación WhatsApp cuando se completa una tarea importante (best-effort)
  if (parsed.data === 'completed' && data.important) {
    sendWhatsApp(buildCompletionMessage(data)).catch((err) =>
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

  const owns = await verifyOwnership(uid, taskId);
  if (!owns) return { ok: false, error: 'Tarea no encontrada' };

  const startsAt = parseDateTimeToUTC(parsed.data.date, parsed.data.time);
  const weekKey  = getWeekKeyFromDate(startsAt);

  await db().collection(COL.assistantTasks).doc(taskId).update({
    startsAt,
    weekKey,
    status:    'pending',
    updatedAt: FieldValue.serverTimestamp(),
  });

  revalidatePath('/tareas');
  return { ok: true };
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const owns = await verifyOwnership(uid, taskId);
  if (!owns) return { ok: false, error: 'Tarea no encontrada' };

  await db().collection(COL.assistantTasks).doc(taskId).delete();
  revalidatePath('/tareas');
  return { ok: true };
}
