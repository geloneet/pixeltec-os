/**
 * systemAlerts writer (Fase 4 — Postgres, antes Firestore).
 *
 * Used by server actions and cron endpoints to surface critical
 * misconfigurations (missing envs, repeated email delivery failures, etc.)
 * without crashing the user-facing flow.
 *
 * Inspect via psql / drizzle studio; no UI reader exists.
 */

import { db } from '@/lib/db';
import { systemAlerts } from '@/lib/db/schema';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface SystemAlertInput {
  severity: AlertSeverity;
  source: string;
  message: string;
  context?: Record<string, unknown>;
}

export async function logSystemAlert(input: SystemAlertInput): Promise<void> {
  try {
    await db.insert(systemAlerts).values({
      severity: input.severity,
      source: input.source,
      message: input.message,
      context: input.context ?? null,
    });
  } catch (err) {
    // Last-resort fallback: never let alert logging break the caller.
    console.error('[systemAlerts] log failed', err, input);
  }
}
