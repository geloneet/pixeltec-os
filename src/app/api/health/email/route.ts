/**
 * GET /api/health/email
 *
 * Healthcheck for the email pipeline's env wiring. Protected by
 * `Authorization: Bearer ${CRON_SECRET}` and intended to be polled by
 * the VPS monitoring stack.
 *
 *   Response 200: { ok: true,  missing: [] }
 *   Response 503: { ok: false, missing: ["RESEND_API_KEY", ...] }
 *   Response 401: { error: "Unauthorized" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkEmailEnv } from '@/lib/email-env-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const status = checkEmailEnv();

  return NextResponse.json(
    {
      ok: status.ok,
      missing: status.ok ? [] : status.missing,
      timestamp: new Date().toISOString(),
    },
    { status: status.ok ? 200 : 503 }
  );
}
