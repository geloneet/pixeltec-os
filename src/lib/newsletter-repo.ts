/**
 * newsletterSubscribers repository (Fase 4 — Postgres, antes Firestore).
 *
 * Unique index en `email` reemplaza el doc-id-hasheado de Firestore como
 * garantía anti-duplicados. subscribeOrReactivate is the only legitimate
 * entry point from server actions.
 */

import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { newsletterSubscribers } from '@/lib/db/schema';

export type SubscriberStatus = 'active' | 'unsubscribed' | 'bounced';

export interface SubscribeResult {
  /** New row inserted. */
  created: boolean;
  /** Existing row with status='unsubscribed'|'bounced' flipped back to 'active'. */
  reactivated: boolean;
  /** Existing row with status='active' — no email should be sent. */
  alreadyActive: boolean;
  /** Stable across reactivations — embed in the welcome email's unsubscribe link. */
  unsubscribeToken: string;
}

export function normalizeEmail(raw: string): string {
  return raw.toLowerCase().trim();
}

export type UnsubscribeResult =
  | { status: 'unsubscribed'; email: string }
  | { status: 'already-unsubscribed'; email: string }
  | { status: 'not-found' };

/**
 * Look up a subscriber by unsubscribe token and flip them to
 * `status: 'unsubscribed'`. Token is NOT rotated — a later
 * subscribeOrReactivate() call with the same email will reactivate the
 * same row and the link in any prior email keeps working idempotently.
 */
export async function unsubscribeByToken(rawToken: string): Promise<UnsubscribeResult> {
  const token = rawToken.trim();
  if (!token) return { status: 'not-found' };

  const [row] = await db
    .select({ id: newsletterSubscribers.id, email: newsletterSubscribers.email, status: newsletterSubscribers.status })
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.unsubscribeToken, token))
    .limit(1);

  if (!row) return { status: 'not-found' };

  if (row.status === 'unsubscribed') {
    return { status: 'already-unsubscribed', email: row.email };
  }

  await db
    .update(newsletterSubscribers)
    .set({ status: 'unsubscribed', unsubscribedAt: new Date() })
    .where(eq(newsletterSubscribers.id, row.id));
  return { status: 'unsubscribed', email: row.email };
}

export async function subscribeOrReactivate(
  rawEmail: string,
  source: string
): Promise<SubscribeResult> {
  const email = normalizeEmail(rawEmail);
  const unsubscribeToken = randomUUID();

  // Upsert atómico (reemplaza la transacción de Firestore): si la fila ya
  // existe no cambia nada todavía — el estado real se decide leyendo el
  // resultado, que incluye el status PREVIO gracias a que el DO UPDATE solo
  // corre cuando hay conflicto y devolvemos las columnas actuales.
  const [existing] = await db
    .select({
      id: newsletterSubscribers.id,
      status: newsletterSubscribers.status,
      unsubscribeToken: newsletterSubscribers.unsubscribeToken,
    })
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, email))
    .limit(1);

  if (!existing) {
    // Carrera posible entre el select y el insert — el unique index en email
    // convierte el duplicado en conflicto y lo tratamos como "ya activo".
    const inserted = await db
      .insert(newsletterSubscribers)
      .values({ email, status: 'active', source, unsubscribeToken })
      .onConflictDoNothing({ target: newsletterSubscribers.email })
      .returning({ id: newsletterSubscribers.id });
    if (inserted.length > 0) {
      return { created: true, reactivated: false, alreadyActive: false, unsubscribeToken };
    }
    // Perdimos la carrera — leer la fila ganadora.
    const [winner] = await db
      .select({ status: newsletterSubscribers.status, unsubscribeToken: newsletterSubscribers.unsubscribeToken })
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.email, email))
      .limit(1);
    return {
      created: false,
      reactivated: false,
      alreadyActive: winner?.status === 'active',
      unsubscribeToken: winner?.unsubscribeToken ?? unsubscribeToken,
    };
  }

  if (existing.status === 'active') {
    return {
      created: false,
      reactivated: false,
      alreadyActive: true,
      unsubscribeToken: existing.unsubscribeToken,
    };
  }

  await db
    .update(newsletterSubscribers)
    .set({ status: 'active', source, reactivatedAt: new Date() })
    .where(eq(newsletterSubscribers.id, existing.id));
  return {
    created: false,
    reactivated: true,
    alreadyActive: false,
    unsubscribeToken: existing.unsubscribeToken,
  };
}
