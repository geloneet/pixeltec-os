'use server';

// Postgres (Drizzle) — antes Firestore `assistantTemplates`.
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { getSessionUid } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { assistantTasks, assistantTemplates, type AssistantTemplate } from '@/lib/db/schema';
import { publicId, resolveOwnerId, resolveTemplateRow } from '../pg';
import {
  AssistantTemplateCreateSchema,
  AssistantTemplateUpdateSchema,
  type ActionResult,
} from '../schemas';
import { buildWeeklyRRule, generateTaskInstancesForWeek } from '../rrule-helpers';
import { getTemplates } from '../queries/templates';
import { getCurrentWeekKey } from '../week-helpers';

/** Fila del template si existe y pertenece al uid; null en cualquier otro caso. */
async function getOwnedTemplateRow(
  uid: string,
  templateId: string,
): Promise<AssistantTemplate | null> {
  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return null;
  const row = await resolveTemplateRow(templateId);
  if (!row || row.ownerId !== ownerId) return null;
  return row;
}

export async function createTemplate(
  input: unknown,
): Promise<ActionResult<{ templateId: string }>> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const parsed = AssistantTemplateCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return { ok: false, error: 'No autenticado' };

  const { title, description, category, weekdays, defaultTime, durationMin } = parsed.data;
  const rrule = buildWeeklyRRule(weekdays);

  const [row] = await db
    .insert(assistantTemplates)
    .values({
      ownerId,
      title,
      description: description ?? null,
      category,
      rrule,
      defaultTime,
      durationMin,
      active: true,
    })
    .returning();

  revalidatePath('/tareas/templates');
  return { ok: true, data: { templateId: publicId(row) } };
}

export async function updateTemplate(
  templateId: string,
  input: unknown,
): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const parsed = AssistantTemplateUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  const row = await getOwnedTemplateRow(uid, templateId);
  if (!row) return { ok: false, error: 'Template no encontrado' };

  const updates: Partial<typeof assistantTemplates.$inferInsert> = { updatedAt: new Date() };
  const { title, description, category, weekdays, defaultTime, durationMin } = parsed.data;

  if (title       !== undefined) updates.title       = title;
  if (description !== undefined) updates.description = description;
  if (category    !== undefined) updates.category    = category;
  if (defaultTime !== undefined) updates.defaultTime = defaultTime;
  if (durationMin !== undefined) updates.durationMin = durationMin;
  if (weekdays    !== undefined) updates.rrule       = buildWeeklyRRule(weekdays);

  await db.update(assistantTemplates).set(updates).where(eq(assistantTemplates.id, row.id));
  revalidatePath('/tareas/templates');
  return { ok: true };
}

export async function toggleTemplateActive(templateId: string): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const row = await getOwnedTemplateRow(uid, templateId);
  if (!row) return { ok: false, error: 'Template no encontrado' };

  await db
    .update(assistantTemplates)
    .set({ active: !row.active, updatedAt: new Date() })
    .where(eq(assistantTemplates.id, row.id));

  revalidatePath('/tareas/templates');
  return { ok: true };
}

export async function deleteTemplate(templateId: string): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const row = await getOwnedTemplateRow(uid, templateId);
  if (!row) return { ok: false, error: 'Template no encontrado' };

  await db.delete(assistantTemplates).where(eq(assistantTemplates.id, row.id));
  revalidatePath('/tareas/templates');
  return { ok: true };
}

export async function generateTasksForCurrentWeek(): Promise<ActionResult<{ created: number; skipped: number }>> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return { ok: false, error: 'No autenticado' };

  const weekKey = getCurrentWeekKey();
  const templates = await getTemplates(uid, { activeOnly: true });

  let created = 0;
  let skipped = 0;

  for (const template of templates) {
    const instances = generateTaskInstancesForWeek(template, weekKey);

    for (const instance of instances) {
      // Idempotency check
      const [existing] = await db
        .select({ id: assistantTasks.id })
        .from(assistantTasks)
        .where(
          and(
            eq(assistantTasks.ownerId, ownerId),
            eq(assistantTasks.templateId, template.id),
            eq(assistantTasks.startsAt, instance.startsAt),
          ),
        )
        .limit(1);

      if (existing) {
        skipped++;
        continue;
      }

      await db.insert(assistantTasks).values({
        ownerId,
        templateId:  template.id,
        title:       instance.title,
        description: instance.description,
        category:    instance.category,
        startsAt:    instance.startsAt,
        durationMin: instance.durationMin,
        status:      'pending',
        weekKey:     instance.weekKey,
      });
      created++;
    }
  }

  revalidatePath('/tareas');
  revalidatePath('/tareas/templates');
  return { ok: true, data: { created, skipped } };
}
