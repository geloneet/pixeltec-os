/**
 * Postgres-backed IP rate limiter for public server actions (Fase 4 — antes
 * Firestore colección `rateLimit`).
 *
 * Fail-open semantics: if Postgres is unreachable we let the request through.
 * The alternative is denying legitimate leads during an outage, which is worse
 * for a high-ticket B2B funnel than letting through a few extra spam attempts
 * while we recover.
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/db/schema';
import { hashIp } from './privacy';

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

function buildKey(bucket: string, ip: string): string {
  const safeBucket = bucket.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
  return `${safeBucket}__${hashIp(ip || 'unknown')}`;
}

/**
 * Borra el contador de un bucket específico — usado cuando un evento
 * legítimo (ej. emitir un código OTP nuevo) debe darle a esa clave un
 * presupuesto fresco, en vez de esperar a que expire la ventana de tiempo.
 * Fail-open silencioso igual que enforceRateLimit: si Postgres falla, no
 * bloquea el flujo principal (el peor caso es que el contador viejo siga
 * vigente un poco más, no que el usuario se quede sin poder continuar).
 */
export async function resetRateLimit(input: Pick<RateLimitInput, 'ip' | 'bucket'>): Promise<void> {
  const { ip, bucket } = input;
  const id = buildKey(bucket, ip);
  try {
    await db.delete(rateLimit).where(eq(rateLimit.id, id));
  } catch (err) {
    console.error('[rateLimit] resetRateLimit backend error — ignoring', { bucket, err });
  }
}

export async function enforceRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const { ip, bucket, max, windowMs } = input;
  const id = buildKey(bucket, ip);

  try {
    const now = new Date();
    const resetAt = new Date(now.getTime() + windowMs);

    // Un solo upsert atómico reemplaza la transacción de Firestore:
    // - fila nueva → count=1, ventana nueva
    // - ventana expirada → reinicia count=1 con ventana nueva
    // - ventana vigente → incrementa count
    const [row] = await db
      .insert(rateLimit)
      .values({ id, bucket, count: 1, resetAt })
      .onConflictDoUpdate({
        target: rateLimit.id,
        set: {
          // Dates van como ISO string + cast — el driver postgres.js no
          // acepta objetos Date crudos dentro de fragmentos sql``.
          count: sql`CASE WHEN ${rateLimit.resetAt} <= ${now.toISOString()}::timestamptz THEN 1 ELSE ${rateLimit.count} + 1 END`,
          resetAt: sql`CASE WHEN ${rateLimit.resetAt} <= ${now.toISOString()}::timestamptz THEN ${resetAt.toISOString()}::timestamptz ELSE ${rateLimit.resetAt} END`,
        },
      })
      .returning({ count: rateLimit.count, resetAt: rateLimit.resetAt });

    if (row.count > max) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec: Math.ceil((row.resetAt.getTime() - now.getTime()) / 1000),
      };
    }

    return { allowed: true, remaining: Math.max(0, max - row.count), retryAfterSec: 0 };
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
