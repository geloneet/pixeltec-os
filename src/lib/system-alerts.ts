/**
 * systemAlerts collection writer — Admin SDK only.
 *
 * Used by server actions and cron endpoints to surface critical
 * misconfigurations (missing envs, repeated email delivery failures, etc.)
 * without crashing the user-facing flow.
 *
 * The collection is locked down in firestore.rules (read/write: if false);
 * inspect it via the Firebase console or a server endpoint.
 */

import { getAdminFirestore } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface SystemAlertInput {
  severity: AlertSeverity;
  source: string;
  message: string;
  context?: Record<string, unknown>;
}

export async function logSystemAlert(input: SystemAlertInput): Promise<void> {
  try {
    await getAdminFirestore()
      .collection('systemAlerts')
      .add({
        severity: input.severity,
        source: input.source,
        message: input.message,
        context: input.context ?? null,
        createdAt: FieldValue.serverTimestamp(),
      });
  } catch (err) {
    // Last-resort fallback: never let alert logging break the caller.
    console.error('[systemAlerts] log failed', err, input);
  }
}
