import { db } from '@/lib/assistant/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { TELEGRAM_COL } from './telegram-auth';

const MAX_HOURS = 168; // 7 días

export interface SilenceCheckResult {
  silenced: boolean;
  expiresAt?: Date;
  reason?: string;
}

export async function checkSilence(): Promise<SilenceCheckResult> {
  try {
    const now = Timestamp.now();
    const snap = await db()
      .collection(TELEGRAM_COL.silences)
      .where('expiresAt', '>', now)
      .orderBy('expiresAt', 'desc')
      .limit(1)
      .get();

    if (snap.empty) return { silenced: false };

    const doc = snap.docs[0].data();
    return {
      silenced:  true,
      expiresAt: doc.expiresAt.toDate(),
      reason:    doc.reason,
    };
  } catch (err) {
    console.error('[silence] checkSilence failed:', err);
    return { silenced: false }; // fail-open
  }
}

export async function createSilence(opts: {
  hours: number;
  silencedBy: string;
  reason?: string;
}): Promise<{ ok: true; expiresAt: Date } | { ok: false; error: string }> {
  if (opts.hours <= 0 || opts.hours > MAX_HOURS) {
    return { ok: false, error: `hours debe estar entre 1 y ${MAX_HOURS}` };
  }

  try {
    const now      = Date.now();
    const expiresAt = new Date(now + opts.hours * 60 * 60 * 1000);

    await db().collection(TELEGRAM_COL.silences).add({
      silencedBy: opts.silencedBy,
      reason:     opts.reason ?? null,
      createdAt:  Timestamp.fromMillis(now),
      expiresAt:  Timestamp.fromDate(expiresAt),
    });

    return { ok: true, expiresAt };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}
