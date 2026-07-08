/**
 * Email-scoped brute-force lockout (Fase 4 — Postgres, antes Firestore
 * `authLockouts`).
 *
 * Tracks failures at the NextAuth `authorize()` callback — catches
 * forged-token / replay attempts and any path where client-side rate limits
 * were bypassed.
 *
 * Lockout schedule (per email):
 *   1-2 fails  → no lockout
 *   3          → 30 seconds
 *   4          → 2 minutes
 *   5          → 10 minutes
 *   6          → 1 hour
 *   7+         → 24 hours
 *
 * Storage: fila en `auth_lockouts` con PK = sha256(email|INTERNAL_IP_SALT)
 * .slice(0,32) — la tabla nunca contiene emails en claro (misma propiedad
 * que tenía el doc-id hasheado de Firestore).
 */

import { createHash } from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { authLockouts } from '@/lib/db/schema';
import { formatRetryAfter } from './rate-limit';

/**
 * Returns lockout duration (ms) for the Nth failure. 0 means no lockout.
 * Schedule mirrors what the spec calls out — kept inside the lib so callers
 * never have to reason about thresholds.
 */
function lockoutDurationMs(failureCount: number): number {
  if (failureCount <= 2) return 0;
  if (failureCount === 3) return 30 * 1000;
  if (failureCount === 4) return 2 * 60 * 1000;
  if (failureCount === 5) return 10 * 60 * 1000;
  if (failureCount === 6) return 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

function hashEmail(email: string): string {
  const salt = process.env.INTERNAL_IP_SALT;
  if (!salt) {
    throw new Error('INTERNAL_IP_SALT is not configured');
  }
  const normalized = email.toLowerCase().trim();
  return createHash('sha256').update(`${normalized}|${salt}`).digest('hex').slice(0, 32);
}

export interface LockoutStatus {
  locked: boolean;
  /** Wall-clock time the lockout lifts (only set when locked=true). */
  until?: Date;
  /** Human-friendly retry hint in Spanish (only set when locked=true). */
  retryAfter?: string;
}

export async function isEmailLocked(email: string): Promise<LockoutStatus> {
  try {
    const [row] = await db
      .select({ lockedUntil: authLockouts.lockedUntil })
      .from(authLockouts)
      .where(eq(authLockouts.email, hashEmail(email)))
      .limit(1);
    const lockedUntilMs = row?.lockedUntil?.getTime() ?? 0;
    if (lockedUntilMs <= Date.now()) return { locked: false };

    const retryAfterSec = Math.ceil((lockedUntilMs - Date.now()) / 1000);
    return {
      locked: true,
      until: new Date(lockedUntilMs),
      retryAfter: formatRetryAfter(retryAfterSec),
    };
  } catch (err) {
    console.error('[auth-brute-force] isEmailLocked failed — failing open', err);
    return { locked: false };
  }
}

/**
 * Increment the failure counter for `email` and (re)compute lockedUntil.
 * Upsert atómico — fallos concurrentes no pierden conteos.
 */
export async function recordAuthFailure(email: string): Promise<void> {
  try {
    const hash = hashEmail(email);
    const now = new Date();

    // El nuevo lockedUntil depende del failureCount YA incrementado — se
    // calcula en SQL para mantener la atomicidad del upsert. Dates van como
    // ISO string + cast (el driver no acepta Date crudo en sql``).
    const nowIso = now.toISOString();
    const durationCase = sql`
      CASE
        WHEN ${authLockouts.failureCount} + 1 <= 2 THEN NULL
        WHEN ${authLockouts.failureCount} + 1 = 3 THEN ${nowIso}::timestamptz + interval '30 seconds'
        WHEN ${authLockouts.failureCount} + 1 = 4 THEN ${nowIso}::timestamptz + interval '2 minutes'
        WHEN ${authLockouts.failureCount} + 1 = 5 THEN ${nowIso}::timestamptz + interval '10 minutes'
        WHEN ${authLockouts.failureCount} + 1 = 6 THEN ${nowIso}::timestamptz + interval '1 hour'
        ELSE ${nowIso}::timestamptz + interval '24 hours'
      END`;

    await db
      .insert(authLockouts)
      .values({
        email: hash,
        failureCount: 1,
        firstFailureAt: now,
        lastFailureAt: now,
        lockedUntil: lockoutDurationMs(1) > 0 ? new Date(now.getTime() + lockoutDurationMs(1)) : null,
      })
      .onConflictDoUpdate({
        target: authLockouts.email,
        set: {
          failureCount: sql`${authLockouts.failureCount} + 1`,
          lastFailureAt: now,
          lockedUntil: durationCase,
        },
      });
  } catch (err) {
    console.error('[auth-brute-force] recordAuthFailure failed', err);
  }
}

/** Wipe the lockout row after a successful login. */
export async function clearAuthFailures(email: string): Promise<void> {
  try {
    await db.delete(authLockouts).where(eq(authLockouts.email, hashEmail(email)));
  } catch (err) {
    console.error('[auth-brute-force] clearAuthFailures failed', err);
  }
}
