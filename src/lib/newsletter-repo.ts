/**
 * newsletterSubscribers repository — Admin SDK only.
 *
 * Doc id = normalized email so duplicate subscriptions are impossible.
 * subscribeOrReactivate is the only legitimate entry point from server actions.
 */

import { randomUUID } from 'crypto';
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
}

export function normalizeEmail(raw: string): string {
  return raw.toLowerCase().trim();
}

/** Use this as the document id so each email maps to exactly one subscriber. */
export function subscriberDocId(email: string): string {
  // Firestore doc ids cannot contain '/' and have a 1500-byte limit; emails
  // never realistically hit either, but we encode anyway to be safe.
  return encodeURIComponent(normalizeEmail(email));
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
      tx.set(ref, {
        email,
        status: 'active' as SubscriberStatus,
        source,
        unsubscribeToken: randomUUID(),
        subscribedAt: FieldValue.serverTimestamp(),
      });
      return { created: true, reactivated: false, alreadyActive: false };
    }

    const data = snap.data() as SubscriberRecord;
    if (data.status === 'active') {
      return { created: false, reactivated: false, alreadyActive: true };
    }

    tx.update(ref, {
      status: 'active' as SubscriberStatus,
      source,
      reactivatedAt: FieldValue.serverTimestamp(),
    });
    return { created: false, reactivated: true, alreadyActive: false };
  });
}
