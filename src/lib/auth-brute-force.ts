/**
 * Email-scoped brute-force lockout (Admin SDK only).
 *
 * Complements Firebase Auth's built-in client-side throttling
 * (`auth/too-many-requests`) by tracking failures at the session-cookie
 * endpoint — catches forged-token / replay attempts and any path where
 * client-side rate limits were bypassed.
 *
 * Lockout schedule (per email):
 *   1-2 fails  → no lockout
 *   3          → 30 seconds
 *   4          → 2 minutes
 *   5          → 10 minutes
 *   6          → 1 hour
 *   7+         → 24 hours
 *
 * Storage: `authLockouts/{sha256(email|INTERNAL_IP_SALT).slice(0,32)}`.
 * Doc id is hashed so the collection never contains raw email addresses.
 * Collection is deny-all in firestore.rules — accessed via Admin SDK only.
 */

import { createHash } from 'crypto';
import { getAdminFirestore } from './firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { formatRetryAfter } from './rate-limit';

interface LockoutDoc {
  emailHash: string;
  failureCount: number;
  firstFailureAt: Timestamp;
  lastFailureAt: Timestamp;
  lockedUntil: Timestamp | null;
}

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

function docRef(email: string) {
  return getAdminFirestore().collection('authLockouts').doc(hashEmail(email));
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
    const snap = await docRef(email).get();
    if (!snap.exists) return { locked: false };

    const data = snap.data() as LockoutDoc | undefined;
    const lockedUntilMs = data?.lockedUntil?.toMillis?.() ?? 0;
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
 * Transactional so concurrent failures don't lose counts.
 */
export async function recordAuthFailure(email: string): Promise<void> {
  try {
    const ref = docRef(email);
    const now = Date.now();
    const hash = hashEmail(email);

    await getAdminFirestore().runTransaction(async tx => {
      const snap = await tx.get(ref);
      const existing = snap.exists ? (snap.data() as LockoutDoc) : null;
      const failureCount = (existing?.failureCount ?? 0) + 1;
      const lockoutMs = lockoutDurationMs(failureCount);
      const lockedUntil = lockoutMs > 0 ? Timestamp.fromMillis(now + lockoutMs) : null;

      if (!snap.exists) {
        tx.set(ref, {
          emailHash: hash,
          failureCount,
          firstFailureAt: FieldValue.serverTimestamp(),
          lastFailureAt: FieldValue.serverTimestamp(),
          lockedUntil,
        });
        return;
      }

      tx.update(ref, {
        failureCount,
        lastFailureAt: FieldValue.serverTimestamp(),
        lockedUntil,
      });
    });
  } catch (err) {
    console.error('[auth-brute-force] recordAuthFailure failed', err);
  }
}

/** Wipe the lockout doc after a successful login. */
export async function clearAuthFailures(email: string): Promise<void> {
  try {
    await docRef(email).delete();
  } catch (err) {
    console.error('[auth-brute-force] clearAuthFailures failed', err);
  }
}
