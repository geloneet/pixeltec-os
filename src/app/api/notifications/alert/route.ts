import { NextRequest, NextResponse } from 'next/server';
import { AlertPayloadSchema, type AlertResponse } from '@/lib/notifications/types';
import { sendTelegramMessage } from '@/lib/notifications/telegram';
import { formatAlert } from '@/lib/notifications/alert-formatter';
import { checkRateLimit } from '@/lib/notifications/rate-limit';

export const runtime = 'nodejs';

function unauthorized(): NextResponse<AlertResponse> {
  return NextResponse.json({ ok: false, sent: false, reason: 'unauthorized' }, { status: 401 });
}

export async function POST(req: NextRequest): Promise<NextResponse<AlertResponse>> {
  const auth = req.headers.get('authorization');
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error('[notifications/alert] CRON_SECRET no configurado');
    return NextResponse.json(
      { ok: false, sent: false, reason: 'server_misconfigured' },
      { status: 500 },
    );
  }
  if (!auth || auth !== `Bearer ${expected}`) {
    return unauthorized();
  }

  let payload;
  try {
    const json = await req.json();
    payload = AlertPayloadSchema.parse(json);
  } catch {
    return NextResponse.json(
      { ok: false, sent: false, reason: 'invalid_payload' },
      { status: 400 },
    );
  }

  if (!checkRateLimit(payload.source, payload.severity)) {
    console.log(
      `[notifications/alert] rate-limited source=${payload.source} severity=${payload.severity}`,
    );
    return NextResponse.json(
      { ok: true, sent: false, reason: 'rate_limited' },
      { status: 200 },
    );
  }

  const token = process.env.TELEGRAM_INFRA_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_INFRA_CHAT_ID;
  if (!token || !chatId) {
    console.warn('[notifications/alert] Telegram no configurado');
    return NextResponse.json(
      { ok: true, sent: false, reason: 'telegram_not_configured' },
      { status: 200 },
    );
  }

  const text = formatAlert(payload);
  const result = await sendTelegramMessage({ token, chatId, text });

  console.log(
    `[notifications/alert] source=${payload.source} severity=${payload.severity} ` +
      `title=${payload.title.slice(0, 40)} sent=${result.ok}`,
  );

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, sent: false, reason: result.error },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, sent: true, messageId: result.messageId });
}
