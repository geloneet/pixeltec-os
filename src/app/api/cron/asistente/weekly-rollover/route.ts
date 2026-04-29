import { NextRequest, NextResponse } from 'next/server';
import { performWeeklyRollover } from '@/lib/assistant/rollover';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const uid = process.env.ASSISTANT_OWNER_UID;
  if (!uid) {
    console.error('[cron:asistente/rollover] ASSISTANT_OWNER_UID not set');
    return NextResponse.json(
      { error: 'ASSISTANT_OWNER_UID env var is not configured' },
      { status: 500 },
    );
  }

  try {
    const result = await performWeeklyRollover({ uid, trigger: 'cron' });
    console.log('[cron:asistente/rollover]', result);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[cron:asistente/rollover] unhandled error', err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
