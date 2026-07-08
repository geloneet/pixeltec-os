// Postgres (Drizzle) — antes Firestore (batch atómico → transacción SQL).
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  assistantTasks,
  assistantTasksArchive,
  assistantWeeklyReports,
  type NewAssistantWeeklyReport,
} from '@/lib/db/schema';
import { resolveOwnerId } from './pg';
import { getCurrentWeekKey, getWeekRange } from './week-helpers';
import { getTemplates } from './queries/templates';
import { generateTaskInstancesForWeek } from './rrule-helpers';
import { colorBucketFor } from './history-stats';
import { sendWhatsApp } from '@/lib/whatsapp/sender';
import { renderWeeklyReportMessage } from './whatsapp-report';
import type {
  AssistantWeeklyReportSerialized,
  AssistantTaskCategory,
  ReportTotals,
} from './types';

// ── Private helpers ────────────────────────────────────────────────────────

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function isoWeeksInYear(year: number): number {
  // A year has 53 ISO weeks iff it starts on Thursday, or
  // it starts on Wednesday AND is a leap year.
  // eslint-disable-next-line no-restricted-syntax -- aritmética ISO pura sobre Jan 1 UTC, sin TZ implícita.
  const jan1DayOfWeek = new Date(Date.UTC(year, 0, 1)).getUTCDay(); // 0=Sun..6=Sat
  // Convert to Mon=0..Sun=6
  const d = (jan1DayOfWeek + 6) % 7;
  if (d === 3) return 53; // starts on Thursday
  if (d === 2 && isLeapYear(year)) return 53; // starts on Wednesday and is leap year
  return 52;
}

function computeNextWeekKey(weekKey: string): string {
  const [yearStr, weekStr] = weekKey.split('-W');
  let year = parseInt(yearStr, 10);
  let week = parseInt(weekStr, 10);
  week++;
  if (week > isoWeeksInYear(year)) {
    week = 1;
    year++;
  }
  return `${year}-W${String(week).padStart(2, '0')}`;
}

const CATEGORIES: AssistantTaskCategory[] = [
  'trabajo', 'cliente', 'personal', 'salud', 'aprendizaje',
];

type ReportStatusKey = 'completed' | 'cancelled' | 'postponed' | 'pending' | 'inProgress';

const STATUS_MAP: Record<string, ReportStatusKey> = {
  completed:   'completed',
  cancelled:   'cancelled',
  postponed:   'postponed',
  pending:     'pending',
  in_progress: 'inProgress',
};

function emptyTotals(): ReportTotals {
  return { total: 0, completed: 0, cancelled: 0, postponed: 0, pending: 0, inProgress: 0 };
}

// ── Public export ──────────────────────────────────────────────────────────

export async function performWeeklyRollover(opts: {
  uid: string;
  trigger: 'cron' | 'manual';
  targetWeekKey?: string;
}): Promise<{
  ok: boolean;
  reportId?: string;
  archivedCount: number;
  generatedCount: number;
  skippedGenerationCount: number;
  errors: string[];
  notification?: {
    sent: boolean;
    messageId: string | null;
    error: string | null;
  };
}> {
  // Step 1: Setup
  const weekKey     = opts.targetWeekKey ?? getCurrentWeekKey();
  const nextWeekKey = computeNextWeekKey(weekKey);
  const reportId    = `${opts.uid}_${weekKey}`;
  const { start: weekStart, end: weekEnd } = getWeekRange(weekKey);

  const ownerId = await resolveOwnerId(opts.uid);
  if (!ownerId) {
    return {
      ok:                     false,
      archivedCount:          0,
      generatedCount:         0,
      skippedGenerationCount: 0,
      errors:                 [`No existe usuario para uid ${opts.uid}`],
    };
  }

  // Step 2: Idempotency check — el reporte de la semana ya existe.
  const [existing] = await db
    .select({ id: assistantWeeklyReports.id })
    .from(assistantWeeklyReports)
    .where(
      and(eq(assistantWeeklyReports.ownerId, ownerId), eq(assistantWeeklyReports.weekKey, weekKey)),
    )
    .limit(1);
  if (existing) {
    return {
      ok: true,
      reportId,
      archivedCount: 0,
      generatedCount: 0,
      skippedGenerationCount: 0,
      errors: [],
    };
  }

  // Step 3: Fetch tasks for the closing week
  const tasks = await db
    .select()
    .from(assistantTasks)
    .where(and(eq(assistantTasks.ownerId, ownerId), eq(assistantTasks.weekKey, weekKey)));

  // Step 4: Compute stats from tasks
  const totals = emptyTotals();
  const byCategory: Record<AssistantTaskCategory, ReportTotals> = {
    trabajo:     emptyTotals(),
    cliente:     emptyTotals(),
    personal:    emptyTotals(),
    salud:       emptyTotals(),
    aprendizaje: emptyTotals(),
  };

  for (const task of tasks) {
    totals.total++;
    const cat = byCategory[task.category as AssistantTaskCategory];
    if (cat) cat.total++;

    const statusKey = STATUS_MAP[task.status];
    if (statusKey) {
      totals[statusKey]++;
      if (cat) cat[statusKey]++;
    }
  }

  // Step 5: Generate next-week instances
  const activeTemplates = await getTemplates(opts.uid, { activeOnly: true });
  const allInstances: Array<{
    templateId: string;
    title: string;
    description: string | null;
    category: AssistantTaskCategory;
    startsAt: Date;
    durationMin: number;
    weekKey: string;
  }> = [];

  for (const template of activeTemplates) {
    const instances = generateTaskInstancesForWeek(template, nextWeekKey);
    allInstances.push(...instances);
  }

  // Step 6: Idempotency pre-check for new tasks
  const instancesToCreate: typeof allInstances = [];
  let skippedGenerationCount = 0;

  for (const instance of allInstances) {
    const [exists] = await db
      .select({ id: assistantTasks.id })
      .from(assistantTasks)
      .where(
        and(
          eq(assistantTasks.ownerId, ownerId),
          eq(assistantTasks.templateId, instance.templateId),
          eq(assistantTasks.startsAt, instance.startsAt),
        ),
      )
      .limit(1);
    if (!exists) {
      instancesToCreate.push(instance);
    } else {
      skippedGenerationCount++;
    }
  }

  // Step 7: Atomic SQL transaction — report + archive + delete + new tasks.
  // (Antes: batches de Firestore con chunking a 490 ops, no atómico
  // cross-batch. La transacción de Postgres sí es atómica de punta a punta.)
  try {
    const now = new Date();
    const rate = totals.total > 0 ? totals.completed / totals.total : 0;

    const reportData: NewAssistantWeeklyReport = {
      firestoreId:       reportId, // id público estable, mismo formato que Firestore
      ownerId,
      weekKey,
      weekStart,
      weekEnd,
      totals,
      byCategory,
      generatedAt:       now,
      generatedBy:       opts.trigger,
      colorBucket:       colorBucketFor(rate, totals.total),
      whatsappMessageId: null,
      whatsappSentAt:    null,
      whatsappError:     null,
      emailSentAt:       null,
    };

    const reportRowId = await db.transaction(async (tx) => {
      const [reportRow] = await tx
        .insert(assistantWeeklyReports)
        .values(reportData)
        .returning({ id: assistantWeeklyReports.id });

      // Archive existing tasks (preserva id y firestoreId de la fila viva)
      for (const task of tasks) {
        await tx.insert(assistantTasksArchive).values({ ...task, archivedAt: now });
        await tx.delete(assistantTasks).where(eq(assistantTasks.id, task.id));
      }

      // Create new-week tasks
      for (const instance of instancesToCreate) {
        await tx.insert(assistantTasks).values({
          ownerId,
          templateId:  instance.templateId,
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
      }

      return reportRow.id;
    });

    const archivedCount  = tasks.length;
    const generatedCount = instancesToCreate.length;

    // Step 8: Notify owner via WhatsApp (best-effort, non-blocking).
    // Failures here update the report row with whatsappError but never
    // throw — the rollover already completed its critical work.
    let whatsappResult: {
      messageId: string | null;
      sentAt: Date | null;
      error: string | null;
    } = { messageId: null, sentAt: null, error: null };

    try {
      const serializedReport: AssistantWeeklyReportSerialized = {
        id:                reportId,
        uid:               opts.uid,
        weekKey,
        weekStart:         weekStart.toISOString(),
        weekEnd:           weekEnd.toISOString(),
        totals,
        byCategory,
        generatedAt:       now.toISOString(),
        generatedBy:       opts.trigger,
        whatsappMessageId: null,
        whatsappSentAt:    null,
        whatsappError:     null,
        emailSentAt:       null,
      };
      const message = renderWeeklyReportMessage(serializedReport);
      const sent = await sendWhatsApp(message);
      whatsappResult = {
        messageId: sent.messageId,
        sentAt:    new Date(),
        error:     null,
      };
      console.log(`[rollover] whatsapp sent: ${sent.messageId}`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      whatsappResult = { messageId: null, sentAt: null, error: errMsg };
      console.error('[rollover] whatsapp send failed:', errMsg);
    }

    // Persist the delivery outcome on the report row that already exists.
    try {
      await db
        .update(assistantWeeklyReports)
        .set({
          whatsappMessageId: whatsappResult.messageId,
          whatsappSentAt:    whatsappResult.sentAt,
          whatsappError:     whatsappResult.error,
        })
        .where(eq(assistantWeeklyReports.id, reportRowId));
    } catch (updateErr) {
      console.error('[rollover] failed to persist whatsapp status:', updateErr);
    }

    if (archivedCount > 0 || generatedCount > 0) {
      try {
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret) {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pixeltec.mx';
          await fetch(`${baseUrl}/api/notifications/alert`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${cronSecret}`,
            },
            body: JSON.stringify({
              source: 'asistente-rollover',
              severity: 'info',
              title: `Rollover semanal ${weekKey} → ${nextWeekKey}`,
              message:
                `Archivadas: ${archivedCount} tasks · Generadas: ${generatedCount} ` +
                `· Skipped: ${skippedGenerationCount}`,
              metadata: {
                reportId,
                weekKey,
                nextWeekKey,
                errorsCount: 0,
              },
            }),
          });
        }
      } catch (err) {
        console.warn('[rollover] notification failed (non-blocking):', err);
      }
    }

    return {
      ok:                    true,
      reportId,
      archivedCount,
      generatedCount,
      skippedGenerationCount,
      errors:                [],
      notification: {
        sent:      whatsappResult.messageId !== null,
        messageId: whatsappResult.messageId,
        error:     whatsappResult.error,
      },
    };
  } catch (err) {
    return {
      ok:                    false,
      archivedCount:         0,
      generatedCount:        0,
      skippedGenerationCount: 0,
      errors:                [(err as Error).message],
    };
  }
}
