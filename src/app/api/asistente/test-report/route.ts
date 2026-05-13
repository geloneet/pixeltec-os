/**
 * GET /api/asistente/test-report
 *
 * Smoke-test endpoint for the weekly report WhatsApp delivery.
 *
 * Reads the most recent AssistantWeeklyReport for ASSISTANT_OWNER_UID,
 * re-renders the message body via the same pure renderer the rollover
 * uses, and re-sends it via WhatsApp. Does NOT touch rollover state —
 * no archive, no generate, no update on whatsappSentAt/whatsappError of
 * the report doc. Useful to validate the message format without waiting
 * until Sunday 12:00.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsApp } from '@/lib/whatsapp/sender';
import { renderWeeklyReportMessage } from '@/lib/assistant/whatsapp-report';
import { db, COL } from '@/lib/assistant/firebase-admin';
import type { AssistantWeeklyReportDoc } from '@/lib/assistant/types';

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
    const snap = await db()
      .collection(COL.assistantWeeklyReports)
      .where('uid', '==', uid)
      .orderBy('generatedAt', 'desc')
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json(
        { ok: false, error: 'No reports found for this uid' },
        { status: 404 },
      );
    }

    const reportDoc = snap.docs[0].data() as AssistantWeeklyReportDoc;
    const message = renderWeeklyReportMessage(reportDoc);
    const result = await sendWhatsApp(message);

    return NextResponse.json({
      ok: true,
      messageId: result.messageId,
      to: result.to,
      reportId: snap.docs[0].id,
      weekKey: reportDoc.weekKey,
      preview: message.length > 200 ? message.slice(0, 200) + '...' : message,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: errMsg }, { status: 500 });
  }
}
