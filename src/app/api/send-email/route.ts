/**
 * POST /api/send-email
 *
 * Generic email endpoint — used by the admin test panel.
 * Protected: requires an authenticated session (requireSession); RESEND_API_KEY
 * is still required for the send itself to succeed, but is not an auth control.
 *
 * Body: { type: 'test', to: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { sendTestEmail } from '@/lib/email';
import { requireSession } from '@/lib/vpsClient';

const schema = z.object({
  type: z.literal('test'),
  to:   z.string().email(),
});

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value ?? '';
  const session = await requireSession(sessionCookie);
  if (!session.ok) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Reject if API key is not configured (send would fail regardless)
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'RESEND_API_KEY no está configurado en el servidor.' },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Cuerpo de la petición inválido.' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const result = await sendTestEmail(parsed.data.to);

  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
