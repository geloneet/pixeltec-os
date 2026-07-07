import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { db, COL } from '@/lib/assistant/firebase-admin';
import { sendWhatsApp } from '@/lib/whatsapp/sender';
import type { AssistantTaskDoc } from '@/lib/assistant/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Ventana de recordatorio: tareas que empiezan en los próximos WINDOW_MIN minutos.
// El cron corre cada 15 min → ventana de 15 min evita dobles notificaciones.
const WINDOW_MIN = 15;

function buildReminderMessage(tasks: Array<AssistantTaskDoc & { id: string }>): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pixeltec.mx';
  const fmt = (iso: Date) =>
    new Intl.DateTimeFormat('es-MX', {
      hour: 'numeric', minute: '2-digit', hour12: true,
      timeZone: 'America/Mexico_City',
    }).format(iso);

  const lines = ['⏰ PixelTEC OS — Recordatorio de tareas', ''];

  for (const t of tasks) {
    const startsAt = (t.startsAt as unknown as { toDate(): Date }).toDate();
    lines.push(`• ${fmt(startsAt)}  ${t.title}${t.important ? ' ⭐' : ''}`);
  }

  lines.push('', `${appUrl}/tareas`);
  return lines.join('\n');
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  if (!expected || auth !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const uid = process.env.ASSISTANT_OWNER_UID;
  if (!uid) {
    console.error('[cron:task-reminder] ASSISTANT_OWNER_UID not set');
    return NextResponse.json({ error: 'ASSISTANT_OWNER_UID not configured' }, { status: 500 });
  }

  const now    = new Date();
  const cutoff = new Date(now.getTime() + WINDOW_MIN * 60 * 1000);

  // Filtramos solo por rango de tiempo (evita índice compuesto uid+startsAt).
  // El uid se valida en código — es seguro porque este endpoint usa ASSISTANT_OWNER_UID.
  const snap = await db()
    .collection(COL.assistantTasks)
    .where('startsAt', '>=', Timestamp.fromDate(now))
    .where('startsAt', '<=', Timestamp.fromDate(cutoff))
    .get();

  const upcoming = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as AssistantTaskDoc) }))
    .filter((t) => t.uid === uid && (t.status === 'pending' || t.status === 'in_progress'));

  console.log(`[cron:task-reminder] ${upcoming.length} tareas en los próximos ${WINDOW_MIN} min`);

  if (upcoming.length === 0) {
    return NextResponse.json({ ok: true, sent: false, count: 0 });
  }

  try {
    const message = buildReminderMessage(upcoming);
    const result  = await sendWhatsApp(message);
    console.log('[cron:task-reminder] enviado', result.messageId);
    return NextResponse.json({ ok: true, sent: true, count: upcoming.length, messageId: result.messageId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cron:task-reminder] error enviando WhatsApp:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
