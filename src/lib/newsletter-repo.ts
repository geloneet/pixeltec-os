/**
 * newsletterSubscribers repository — Admin SDK only.
 *
 * Doc id = normalized email so duplicate subscriptions are impossible.
 * subscribeOrReactivate is the only legitimate entry point from server actions.
 */

import { createHash, randomUUID } from 'crypto';
import { getAdminFirestore } from './firebase-admin';
import { FieldValue, type Timestamp } from 'firebase-admin/firestore';

export type SubscriberStatus = 'active' | 'unsubscribed' | 'bounced';

export interface SubscriberRecord {
  email: string;
  status: SubscriberStatus;
  subscribedAt: Timestamp;
  source: string;
  unsubscribeToken: string;
  reactivatedAt?: Timestamp;
}

export interface SubscribeResult {
  /** New doc inserted. */
  created: boolean;
  /** Existing doc with status='unsubscribed'|'bounced' flipped back to 'active'. */
  reactivated: boolean;
  /** Existing doc with status='active' — no email should be sent. */
  alreadyActive: boolean;
  /** Stable across reactivations — embed in the welcome email's unsubscribe link. */
  unsubscribeToken: string;
}

export function normalizeEmail(raw: string): string {
  return raw.toLowerCase().trim();
}

/**
 * Use this as the document id so each email maps to exactly one subscriber.
 *
 * Hashed with sha256 (32-char prefix) instead of URL-encoded so the id is
 * Firestore-safe regardless of internationalized email content and so the
 * id never leaks PII in URLs or logs. Reverse lookup uses the stored
 * `email` field.
 */
export function subscriberDocId(email: string): string {
  return createHash('sha256').update(normalizeEmail(email)).digest('hex').slice(0, 32);
}

export type UnsubscribeResult =
  | { status: 'unsubscribed'; email: string }
  | { status: 'already-unsubscribed'; email: string }
  | { status: 'not-found' };

/**
 * Look up a subscriber by unsubscribe token and flip them to
 * `status: 'unsubscribed'`. Token is NOT rotated — a later
 * subscribeOrReactivate() call with the same email will reactivate the
 * same doc and the link in any prior email keeps working idempotently.
 *
 * Requires a single-field index on unsubscribeToken (declared in
 * firestore.indexes.json — Firestore auto-creates single-field indexes
 * but we keep it explicit).
 */
export async function unsubscribeByToken(rawToken: string): Promise<UnsubscribeResult> {
  const token = rawToken.trim();
  if (!token) return { status: 'not-found' };

  const db = getAdminFirestore();
  const snap = await db
    .collection('newsletterSubscribers')
    .where('unsubscribeToken', '==', token)
    .limit(1)
    .get();

  if (snap.empty) return { status: 'not-found' };

  const docRef = snap.docs[0].ref;
  const data = snap.docs[0].data() as SubscriberRecord;

  if (data.status === 'unsubscribed') {
    return { status: 'already-unsubscribed', email: data.email };
  }

  await docRef.update({
    status: 'unsubscribed' as SubscriberStatus,
    unsubscribedAt: FieldValue.serverTimestamp(),
  });
  return { status: 'unsubscribed', email: data.email };
}

export async function subscribeOrReactivate(
  rawEmail: string,
  source: string
): Promise<SubscribeResult> {
  const db = getAdminFirestore();
  const email = normalizeEmail(rawEmail);
  const ref = db.collection('newsletterSubscribers').doc(subscriberDocId(email));

  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);

    if (!snap.exists) {
      const unsubscribeToken = randomUUID();
      tx.set(ref, {
        email,
        status: 'active' as SubscriberStatus,
        source,
        unsubscribeToken,
        subscribedAt: FieldValue.serverTimestamp(),
      });
      return { created: true, reactivated: false, alreadyActive: false, unsubscribeToken };
    }

    const data = snap.data() as SubscriberRecord;
    if (data.status === 'active') {
      return {
        created: false,
        reactivated: false,
        alreadyActive: true,
        unsubscribeToken: data.unsubscribeToken,
      };
    }

    tx.update(ref, {
      status: 'active' as SubscriberStatus,
      source,
      reactivatedAt: FieldValue.serverTimestamp(),
    });
    return {
      created: false,
      reactivated: true,
      alreadyActive: false,
      unsubscribeToken: data.unsubscribeToken,
    };
  });
}
