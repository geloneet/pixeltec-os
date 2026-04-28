'use server';

import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { db, COL } from '../firebase-admin';
import {
  AssistantTaskCreateSchema,
  AssistantTaskUpdateSchema,
  AssistantTaskStatusSchema,
  AssistantPostponeSchema,
  type ActionResult,
} from '../schemas';
import { parseDateTimeToUTC, getWeekKeyFromDate, formatDateMX, formatTimeMX } from '../week-helpers';
import type { AssistantTaskDoc, AssistantTaskStatus } from '../types';

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
): Promise<ActionResult<{ taskId: string }>> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const parsed = AssistantTaskCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  const { title, description, category, date, time, durationMin } = parsed.data;
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
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath('/asistente');
  return { ok: true, data: { taskId: ref.id } };
}

export async function updateTask(
  taskId: string,
  input: unknown,
): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const parsed = AssistantTaskUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  const owns = await verifyOwnership(uid, taskId);
  if (!owns) return { ok: false, error: 'Tarea no encontrada' };

  const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  const { title, description, category, date, time, durationMin } = parsed.data;

  if (title       !== undefined) updates.title       = title;
  if (description !== undefined) updates.description = description;
  if (category    !== undefined) updates.category    = category;
  if (durationMin !== undefined) updates.durationMin = durationMin;

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
  revalidatePath('/asistente');
  return { ok: true };
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

  revalidatePath('/asistente');
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

  revalidatePath('/asistente');
  return { ok: true };
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const owns = await verifyOwnership(uid, taskId);
  if (!owns) return { ok: false, error: 'Tarea no encontrada' };

  await db().collection(COL.assistantTasks).doc(taskId).delete();
  revalidatePath('/asistente');
  return { ok: true };
}
