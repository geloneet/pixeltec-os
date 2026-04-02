/**
 * POST /api/send-email
 *
 * Generic email endpoint — used by the admin test panel.
 * Protected: requires RESEND_API_KEY to be configured server-side.
 *
 * Body: { type: 'test', to: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendTestEmail } from '@/lib/email';

const schema = z.object({
  type: z.literal('test'),
  to:   z.string().email(),
});

export async function POST(req: NextRequest) {
  // Basic protection: reject if API key is not configured
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
