import { Timestamp } from 'firebase-admin/firestore';
import { db, COL } from './firebase-admin';
import { getCurrentWeekKey, getWeekRange } from './week-helpers';
import { getTemplates } from './queries/templates';
import { generateTaskInstancesForWeek } from './rrule-helpers';
import type {
  AssistantTaskDoc,
  AssistantWeeklyReportDoc,
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
}> {
  // Step 1: Setup
  const weekKey     = opts.targetWeekKey ?? getCurrentWeekKey();
  const nextWeekKey = computeNextWeekKey(weekKey);
  const reportId    = `${opts.uid}_${weekKey}`;
  const { start: weekStart, end: weekEnd } = getWeekRange(weekKey);

  // Step 2: Idempotency check
  const reportRef = db().collection(COL.assistantWeeklyReports).doc(reportId);
  const existing  = await reportRef.get();
  if (existing.exists) {
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
  const tasksSnap = await db()
    .collection(COL.assistantTasks)
    .where('uid', '==', opts.uid)
    .where('weekKey', '==', weekKey)
    .get();
  const tasks = tasksSnap.docs;

  // Step 4: Compute stats from tasks
  const totals = emptyTotals();
  const byCategory: Record<AssistantTaskCategory, ReportTotals> = {
    trabajo:     emptyTotals(),
    cliente:     emptyTotals(),
    personal:    emptyTotals(),
    salud:       emptyTotals(),
    aprendizaje: emptyTotals(),
  };

  for (const docSnap of tasks) {
    const task = docSnap.data() as AssistantTaskDoc;
    totals.total++;
    const cat = byCategory[task.category];
    cat.total++;

    const statusKey = STATUS_MAP[task.status];
    if (statusKey) {
      totals[statusKey]++;
      cat[statusKey]++;
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
    const exists = await db()
      .collection(COL.assistantTasks)
      .where('uid', '==', opts.uid)
      .where('templateId', '==', instance.templateId)
      .where('startsAt', '==', instance.startsAt)
      .limit(1)
      .get();
    if (exists.empty) {
      instancesToCreate.push(instance);
    } else {
      skippedGenerationCount++;
    }
  }

  // TODO(scale): batch chunking NO es atómico cross-batch.
  // Si crash entre commits → estado parcial. Aceptable con volumen bajo.
  // Cuando tasks > 400 considerar refactor a checkpoint pattern
  // (status: 'rolling-over' → archivar en chunks idempotentes → 'complete').
  if (tasks.length > 400) {
    console.warn(
      `[rollover] uid=${opts.uid} weekKey=${weekKey} tasks=${tasks.length} ` +
      `cerca del límite de batch atómico. Considerar refactor.`,
    );
  }

  // Step 7: Atomic Firestore batch
  try {
    const nowTs = Timestamp.now();

    // First batch: report + first chunk of archives + new tasks
    let batch   = db().batch();
    let opCount = 0;
    const batches = [batch];

    function ensureCapacity(opsNeeded: number) {
      if (opCount + opsNeeded > 490) {
        batch = db().batch();
        batches.push(batch);
        opCount = 0;
      }
      opCount += opsNeeded;
    }

    // Set report doc
    const reportData: AssistantWeeklyReportDoc = {
      uid:               opts.uid,
      weekKey,
      weekStart:         Timestamp.fromDate(weekStart),
      weekEnd:           Timestamp.fromDate(weekEnd),
      totals,
      byCategory,
      generatedAt:       nowTs,
      generatedBy:       opts.trigger,
      telegramMessageId: null,
      telegramSentAt:    null,
      emailSentAt:       null,
    };
    batches[0].set(reportRef, reportData);
    opCount++;

    // Archive existing tasks
    for (const docSnap of tasks) {
      ensureCapacity(2);
      const archiveRef = db().collection(COL.assistantTasksArchive).doc(docSnap.id);
      const taskData   = docSnap.data() as AssistantTaskDoc;
      batch.set(archiveRef, { ...taskData, archivedAt: nowTs });
      batch.delete(docSnap.ref);
    }

    // Create new-week tasks
    for (const instance of instancesToCreate) {
      ensureCapacity(1);
      const newRef = db().collection(COL.assistantTasks).doc();
      batch.set(newRef, {
        uid:         opts.uid,
        templateId:  instance.templateId,
        title:       instance.title,
        description: instance.description,
        category:    instance.category,
        startsAt:    Timestamp.fromDate(instance.startsAt),
        durationMin: instance.durationMin,
        status:      'pending' as const,
        weekKey:     instance.weekKey,
        createdAt:   nowTs,
        updatedAt:   nowTs,
      });
    }

    // Commit all batches
    for (const b of batches) {
      await b.commit();
    }

    const archivedCount  = tasks.length;
    const generatedCount = instancesToCreate.length;

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
