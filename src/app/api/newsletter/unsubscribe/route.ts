/**
 * GET /api/newsletter/unsubscribe?token=<uuid>
 *
 * Public, unauthenticated. Reached by clicking the footer link in
 * NewsletterWelcomeEmail. Idempotent — clicking twice from the same
 * email is a no-op on the second visit.
 *
 * No confirmation email is sent on unsubscribe: deliverability hygiene
 * (avoid bounce loops) and cost (Resend per-message). The visual page
 * response is the only feedback.
 *
 * Rate-limited to 100 hits / hour / IP via the shared rateLimit bucket
 * — generous on purpose to accommodate corporate NAT (see comment on
 * the constant below). The real defense against token-guessing is the
 * UUID v4 entropy of the unsubscribeToken, not the IP cap.
 */

import { NextRequest, NextResponse } from 'next/server';
import { unsubscribeByToken, type UnsubscribeResult } from '@/lib/newsletter-repo';
import { enforceRateLimit, formatRetryAfter } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Rate-limit alto porque corporativos NAT-eados (varios empleados detrás
// de una misma IP pública) pueden disparar muchos hits legítimos cuando
// todos reciben el mismo newsletter y deciden darse de baja. GDPR Art. 7
// exige que retirar consentimiento sea tan fácil como darlo, así que no
// podemos bloquearles la salida. El espacio UUID v4 (2^122 ≈ 5.3e36)
// hace inviable el token-guessing aun con 100 req/h sostenidas durante
// años; la rate-limit aquí es contra scrapers triviales, no defensa
// principal.
const RATE_LIMIT = { max: 100, windowMs: 60 * 60 * 1000 } as const;

function htmlResponse(body: string, status = 200): NextResponse {
  return new NextResponse(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function page(opts: { title: string; heading: string; lede: string; cta?: { href: string; label: string } }): string {
  const ctaHtml = opts.cta
    ? `<a href="${opts.cta.href}" style="display:inline-block;margin-top:32px;padding:13px 32px;border-radius:10px;background:#06b6d4;color:#000;font-weight:700;font-size:14px;text-decoration:none;">${opts.cta.label}</a>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex,nofollow" />
<title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#fafafa;min-height:100vh;display:flex;align-items:center;justify-content:center;">
  <main style="max-width:520px;width:100%;padding:48px 32px;text-align:center;">
    <p style="margin:0 0 24px;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Pixel<span style="color:#06b6d4;">TEC</span></p>
    <div style="border:1px solid #27272a;border-radius:20px;padding:40px 32px;background:#111111;">
      <div style="height:3px;background:linear-gradient(90deg,#06b6d4,#a3e635);border-radius:2px;margin:-40px -32px 32px;"></div>
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fafafa;">${opts.heading}</h1>
      <p style="margin:0;font-size:15px;line-height:1.7;color:#a1a1aa;">${opts.lede}</p>
      ${ctaHtml}
    </div>
    <p style="margin:24px 0 0;font-size:12px;color:#52525b;">
      <a href="https://pixeltec.mx" style="color:#52525b;text-decoration:underline;">pixeltec.mx</a>
    </p>
  </main>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';

  const rl = await enforceRateLimit({
    ip,
    bucket: 'newsletter_unsubscribe',
    max: RATE_LIMIT.max,
    windowMs: RATE_LIMIT.windowMs,
  });
  if (!rl.allowed) {
    return htmlResponse(
      page({
        title: 'Demasiados intentos — PixelTEC',
        heading: 'Demasiados intentos',
        lede: `Por seguridad, espera ${formatRetryAfter(rl.retryAfterSec)} antes de intentar de nuevo.`,
      }),
      429
    );
  }

  const token = req.nextUrl.searchParams.get('token') ?? '';
  if (!token) {
    return htmlResponse(
      page({
        title: 'Token inválido — PixelTEC',
        heading: 'Enlace incompleto',
        lede: 'No recibimos el token de baja. Vuelve al correo y haz clic en el enlace original.',
      }),
      400
    );
  }

  let result: UnsubscribeResult;
  try {
    result = await unsubscribeByToken(token);
  } catch (err) {
    console.error('[unsubscribe] failed', err);
    return htmlResponse(
      page({
        title: 'Error — PixelTEC',
        heading: 'No pudimos procesar tu baja',
        lede: 'Algo falló de nuestro lado. Inténtalo de nuevo en unos minutos o escríbenos a contacto@pixeltec.mx.',
      }),
      500
    );
  }

  if (result.status === 'not-found') {
    return htmlResponse(
      page({
        title: 'Token inválido — PixelTEC',
        heading: 'Enlace no reconocido',
        lede: 'Este enlace ya no es válido o tu suscripción nunca existió. Si crees que es un error, escríbenos a contacto@pixeltec.mx.',
      }),
      404
    );
  }

  if (result.status === 'already-unsubscribed') {
    return htmlResponse(
      page({
        title: 'Ya estabas dado de baja — PixelTEC',
        heading: 'Ya te habías dado de baja',
        lede: 'No volveremos a escribirte. Si fue un error y quieres regresar, puedes suscribirte de nuevo cuando quieras.',
        cta: { href: 'https://pixeltec.mx', label: 'Volver a pixeltec.mx →' },
      })
    );
  }

  // status === 'unsubscribed'
  return htmlResponse(
    page({
      title: 'Te diste de baja — PixelTEC',
      heading: 'Te diste de baja',
      lede: 'Lamentamos verte ir. No volveremos a escribirte. ¿Fue un error? Puedes suscribirte de nuevo cuando quieras.',
      cta: { href: 'https://pixeltec.mx', label: 'Suscribirme de nuevo →' },
    })
  );
}
