/**
 * Email environment guard — call at the start of any server action or
 * endpoint that depends on Resend. If a required env var is missing,
 * a critical systemAlert is logged and a structured failure is returned.
 *
 * Keep this list in sync with src/lib/email.ts.
 */

import { logSystemAlert } from './system-alerts';

const REQUIRED_EMAIL_ENVS = [
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'PIXELTEC_TEAM_EMAIL',
  // Not strictly an email env, but every user-facing action that sends
  // email also hashes the caller IP into `leads.ipHash`. Treating them as
  // one bundle gives us a single early-exit before persistence runs.
  'INTERNAL_IP_SALT',
] as const;

export type RequiredEmailEnv = (typeof REQUIRED_EMAIL_ENVS)[number];

export type EmailEnvCheck =
  | { ok: true }
  | { ok: false; missing: RequiredEmailEnv[] };

/**
 * Returns the env status without side effects — useful for healthcheck endpoints.
 */
export function checkEmailEnv(): EmailEnvCheck {
  const missing = REQUIRED_EMAIL_ENVS.filter(k => !process.env[k]) as RequiredEmailEnv[];
  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}

/**
 * Returns the env status AND raises a critical systemAlert when something is missing.
 * Call this from user-facing server actions; show a visible error to the user when ok=false.
 */
export async function assertEmailEnv(source: string): Promise<EmailEnvCheck> {
  const status = checkEmailEnv();
  if (status.ok) return status;

  await logSystemAlert({
    severity: 'critical',
    source,
    message: `Missing email env vars: ${status.missing.join(', ')}`,
    context: { missing: status.missing },
  });

  return status;
}
