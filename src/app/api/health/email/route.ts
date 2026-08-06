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
import { assertCronExecutionAllowed, cronBlockedResponse } from '@/lib/cron-guard';
import { bearerToken, cronSecretMatches } from '@/lib/cron-secret';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!cronSecretMatches(bearerToken(req.headers.get('authorization')))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    assertCronExecutionAllowed();
  } catch (err) {
    const blocked = cronBlockedResponse(err);
    if (blocked) return blocked;
    throw err;
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
