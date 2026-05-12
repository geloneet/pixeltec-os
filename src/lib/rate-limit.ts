/**
 * Firestore-backed IP rate limiter for public server actions.
 * Admin SDK only — keep firestore.rules deny-all on `rateLimit`.
 *
 * Fail-open semantics: if Firestore is unreachable we let the request through.
 * The alternative is denying legitimate leads during an outage, which is worse
 * for a high-ticket B2B funnel than letting through a few extra spam attempts
 * while we recover.
 */

import { createHash } from 'crypto';
import { getAdminFirestore } from './firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export interface RateLimitInput {
  /** Caller IP. `unknown` is acceptable; we still bucket it. */
  ip: string;
  /** Logical bucket — e.g. `contact_form`, `newsletter`. */
  bucket: string;
  /** Max requests per window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 32);
}

function buildKey(bucket: string, ip: string): string {
  const safeBucket = bucket.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
  return `${safeBucket}__${hashIp(ip || 'unknown')}`;
}

export async function enforceRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const { ip, bucket, max, windowMs } = input;
  const id = buildKey(bucket, ip);

  try {
    const db = getAdminFirestore();
    const ref = db.collection('rateLimit').doc(id);
    const now = Date.now();

    return await db.runTransaction(async tx => {
      const snap = await tx.get(ref);

      if (!snap.exists) {
        tx.set(ref, {
          bucket,
          count: 1,
          resetAt: Timestamp.fromMillis(now + windowMs),
          createdAt: FieldValue.serverTimestamp(),
        });
        return { allowed: true, remaining: Math.max(0, max - 1), retryAfterSec: 0 };
      }

      const data = snap.data() as { count?: number; resetAt?: Timestamp };
      const resetAtMs = data.resetAt?.toMillis?.() ?? 0;
      const count = data.count ?? 0;

      if (resetAtMs <= now) {
        // Window expired — start fresh.
        tx.set(ref, {
          bucket,
          count: 1,
          resetAt: Timestamp.fromMillis(now + windowMs),
          createdAt: FieldValue.serverTimestamp(),
        });
        return { allowed: true, remaining: Math.max(0, max - 1), retryAfterSec: 0 };
      }

      if (count >= max) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSec: Math.ceil((resetAtMs - now) / 1000),
        };
      }

      tx.update(ref, { count: FieldValue.increment(1) });
      return {
        allowed: true,
        remaining: Math.max(0, max - count - 1),
        retryAfterSec: 0,
      };
    });
  } catch (err) {
    console.error('[rateLimit] backend error — failing open', { bucket, err });
    return { allowed: true, remaining: max, retryAfterSec: 0 };
  }
}

/** Format `retryAfterSec` as a human Spanish phrase ("X minutos" / "X segundos"). */
export function formatRetryAfter(seconds: number): string {
  if (seconds <= 0) return 'unos instantes';
  if (seconds < 60) return `${seconds} segundos`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? '1 minuto' : `${minutes} minutos`;
}
