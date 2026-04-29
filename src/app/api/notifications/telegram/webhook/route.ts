import { NextRequest, NextResponse } from 'next/server';
import { webhookCallback } from 'grammy';
import { getBot } from '@/lib/notifications/infra-bot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const expected = process.env.TELEGRAM_WEBHOOK_INFRA_SECRET;
  const received = req.headers.get('x-telegram-bot-api-secret-token');
  if (!expected || received !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const handler = webhookCallback(getBot(), 'std/http');
    return await handler(req);
  } catch (err) {
    console.error('[telegram/webhook] error:', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
