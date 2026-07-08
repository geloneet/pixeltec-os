/**
 * GET /api/asistente/test-report
 *
 * Smoke-test endpoint for the weekly report WhatsApp delivery.
 *
 * Reads the most recent AssistantWeeklyReport for ASSISTANT_OWNER_UID,
 * re-renders the message body via the same pure renderer the rollover
 * uses, and re-sends it via WhatsApp. Does NOT touch rollover state —
 * no archive, no generate, no update on whatsappSentAt/whatsappError of
 * the report row. Useful to validate the message format without waiting
 * until Sunday 12:00.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 */

import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { sendWhatsApp } from '@/lib/whatsapp/sender';
import { renderWeeklyReportMessage } from '@/lib/assistant/whatsapp-report';
import { db } from '@/lib/db';
import { assistantWeeklyReports } from '@/lib/db/schema';
import { reportRowToSerialized, resolveOwnerId } from '@/lib/assistant/pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  if (!expected || auth !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const uid = process.env.ASSISTANT_OWNER_UID;
  if (!uid) {
    return NextResponse.json(
      { ok: false, error: 'ASSISTANT_OWNER_UID env var is not configured' },
      { status: 500 },
    );
  }

  try {
    const ownerId = await resolveOwnerId(uid);
    if (!ownerId) {
      return NextResponse.json(
        { ok: false, error: 'No user found for this uid' },
        { status: 404 },
      );
    }

    const [row] = await db
      .select()
      .from(assistantWeeklyReports)
      .where(eq(assistantWeeklyReports.ownerId, ownerId))
      .orderBy(desc(assistantWeeklyReports.generatedAt))
      .limit(1);

    if (!row) {
      return NextResponse.json(
        { ok: false, error: 'No reports found for this uid' },
        { status: 404 },
      );
    }

    const report = reportRowToSerialized(row, uid);
    const message = renderWeeklyReportMessage(report);
    const result = await sendWhatsApp(message);

    return NextResponse.json({
      ok: true,
      messageId: result.messageId,
      to: result.to,
      reportId: report.id,
      weekKey: report.weekKey,
      preview: message.length > 200 ? message.slice(0, 200) + '...' : message,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: errMsg }, { status: 500 });
  }
}
