// Fase 4: Postgres/Drizzle — antes Firestore `infraSilences`.
import { desc, gt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { infraSilences } from '@/lib/db/schema';

const MAX_HOURS = 168; // 7 días

export interface SilenceCheckResult {
  silenced: boolean;
  expiresAt?: Date;
  reason?: string;
}

export async function checkSilence(): Promise<SilenceCheckResult> {
  try {
    const [row] = await db
      .select()
      .from(infraSilences)
      .where(gt(infraSilences.expiresAt, new Date()))
      .orderBy(desc(infraSilences.expiresAt))
      .limit(1);

    if (!row) return { silenced: false };

    return {
      silenced:  true,
      expiresAt: row.expiresAt,
      reason:    row.reason ?? undefined,
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
    const expiresAt = new Date(Date.now() + opts.hours * 60 * 60 * 1000);

    await db.insert(infraSilences).values({
      silencedBy: opts.silencedBy,
      reason:     opts.reason ?? null,
      expiresAt,
    });

    return { ok: true, expiresAt };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}
