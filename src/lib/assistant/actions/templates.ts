'use server';

import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { db, COL } from '../firebase-admin';
import {
  AssistantTemplateCreateSchema,
  AssistantTemplateUpdateSchema,
  type ActionResult,
} from '../schemas';
import { buildWeeklyRRule, generateTaskInstancesForWeek } from '../rrule-helpers';
import { getTemplates } from '../queries/templates';
import { getCurrentWeekKey } from '../week-helpers';
import type { AssistantTemplateDoc } from '../types';

export async function createTemplate(
  input: unknown,
): Promise<ActionResult<{ templateId: string }>> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const parsed = AssistantTemplateCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  const { title, description, category, weekdays, defaultTime, durationMin } = parsed.data;
  const rrule = buildWeeklyRRule(weekdays);
  const now   = FieldValue.serverTimestamp();

  const ref = await db().collection(COL.assistantTemplates).add({
    uid,
    title,
    description: description ?? null,
    category,
    rrule,
    defaultTime,
    durationMin,
    active: true,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath('/asistente/templates');
  return { ok: true, data: { templateId: ref.id } };
}

async function verifyTemplateOwnership(uid: string, templateId: string): Promise<boolean> {
  const doc = await db().collection(COL.assistantTemplates).doc(templateId).get();
  if (!doc.exists) return false;
  return (doc.data() as AssistantTemplateDoc).uid === uid;
}

export async function updateTemplate(
  templateId: string,
  input: unknown,
): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const parsed = AssistantTemplateUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  const owns = await verifyTemplateOwnership(uid, templateId);
  if (!owns) return { ok: false, error: 'Template no encontrado' };

  const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  const { title, description, category, weekdays, defaultTime, durationMin } = parsed.data;

  if (title       !== undefined) updates.title       = title;
  if (description !== undefined) updates.description = description;
  if (category    !== undefined) updates.category    = category;
  if (defaultTime !== undefined) updates.defaultTime = defaultTime;
  if (durationMin !== undefined) updates.durationMin = durationMin;
  if (weekdays    !== undefined) updates.rrule       = buildWeeklyRRule(weekdays);

  await db().collection(COL.assistantTemplates).doc(templateId).update(updates);
  revalidatePath('/asistente/templates');
  return { ok: true };
}

export async function toggleTemplateActive(templateId: string): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const doc = await db().collection(COL.assistantTemplates).doc(templateId).get();
  if (!doc.exists) return { ok: false, error: 'Template no encontrado' };
  const data = doc.data() as AssistantTemplateDoc;
  if (data.uid !== uid) return { ok: false, error: 'Template no encontrado' };

  await doc.ref.update({
    active:    !data.active,
    updatedAt: FieldValue.serverTimestamp(),
  });

  revalidatePath('/asistente/templates');
  return { ok: true };
}

export async function deleteTemplate(templateId: string): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const owns = await verifyTemplateOwnership(uid, templateId);
  if (!owns) return { ok: false, error: 'Template no encontrado' };

  await db().collection(COL.assistantTemplates).doc(templateId).delete();
  revalidatePath('/asistente/templates');
  return { ok: true };
}

export async function generateTasksForCurrentWeek(): Promise<ActionResult<{ created: number; skipped: number }>> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const weekKey = getCurrentWeekKey();
  const templates = await getTemplates(uid, { activeOnly: true });

  let created = 0;
  let skipped = 0;

  for (const template of templates) {
    const instances = generateTaskInstancesForWeek(template, weekKey);

    for (const instance of instances) {
      // Idempotency check
      const existing = await db()
        .collection(COL.assistantTasks)
        .where('uid', '==', uid)
        .where('templateId', '==', template.id)
        .where('startsAt', '==', instance.startsAt)
        .limit(1)
        .get();

      if (!existing.empty) {
        skipped++;
        continue;
      }

      const now = FieldValue.serverTimestamp();
      await db().collection(COL.assistantTasks).add({
        uid,
        templateId:  template.id,
        title:       instance.title,
        description: instance.description,
        category:    instance.category,
        startsAt:    instance.startsAt,
        durationMin: instance.durationMin,
        status:      'pending',
        weekKey:     instance.weekKey,
        createdAt:   now,
        updatedAt:   now,
      });
      created++;
    }
  }

  revalidatePath('/asistente');
  revalidatePath('/asistente/templates');
  return { ok: true, data: { created, skipped } };
}
