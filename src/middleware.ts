import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { PROTECTED_PATHS } from '@/lib/routes/admin-routes';

export const runtime = 'nodejs';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const crypto = require('crypto') as typeof import('crypto');

// Dominios de terceros con script-src propio (fuera del nonce): Cloudflare Web
// Analytics, inyectado a nivel de edge/proxy.
const THIRD_PARTY_SCRIPT_SRC = [
  'https://static.cloudflareinsights.com',
].join(' ');

// Rutas que se embeben a propósito en un <iframe> oculto del mismo origen
// (técnica de "Imprimir": iframe + win.print()). `frame-ancestors 'none'`
// bloquea CUALQUIER framing, incluso del mismo origen, así que rompía ese
// botón en silencio al pasar la CSP de Report-Only a enforcing. Se relaja
// puntualmente a 'self' solo aquí — el resto del sitio se mantiene en 'none'.
const SELF_FRAMEABLE_PATHS = ['/api/documents/proposal-pdf'];

function buildCsp(nonce: string, allowSelfFraming: boolean): string {
  const scriptSrc = process.env.NODE_ENV === 'development'
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' ${THIRD_PARTY_SCRIPT_SRC}`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${THIRD_PARTY_SCRIPT_SRC}`;
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "frame-src 'none'",
    allowSelfFraming ? "frame-ancestors 'self'" : "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    'report-uri /api/csp-report',
    'report-to csp-endpoint',
  ].join('; ');
}

function withSecurityHeaders(res: NextResponse, nonce: string, pathname: string): NextResponse {
  // Enforcing (antes Report-Only): esta es ahora la ÚNICA CSP del sitio — la
  // política estática con 'unsafe-inline'/'unsafe-eval' de next.config.ts se
  // quitó para no tener dos CSP compitiendo (ver next.config.ts).
  const allowSelfFraming = SELF_FRAMEABLE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  res.headers.set('Content-Security-Policy', buildCsp(nonce, allowSelfFraming));
  res.headers.set('Reporting-Endpoints', 'csp-endpoint="/api/csp-report"');
  res.headers.set('x-nonce', nonce);
  return res;
}

// Envuelto con `auth()` de NextAuth (Fase 2 de la migración — reemplaza
// `getAdminAuth().verifySessionCookie` de Firebase). `request.auth` viene
// poblado por el wrapper: no-null si el JWT de sesión es válido, null si no
// hay cookie / la firma no valida / expiró — NextAuth no distingue el motivo,
// así que ya no podemos mostrar "tu sesión expiró" específicamente (antes sí,
// vía el código de error de Firebase). Tampoco hay ya un "fail-open por
// infraestructura": con estrategia JWT no hay round-trip a una DB para
// validar la sesión en cada request (se verifica localmente contra
// NEXTAUTH_SECRET), así que no existe ese modo de fallo.
//
// Nota de seguridad a considerar más adelante: con JWT puro no hay revocación
// instantánea de sesión (logout-all-devices no invalida cookies ya emitidas
// hasta que expiren). Si eso importa, migrar a `session.strategy: "database"`
// con @auth/drizzle-adapter (ya instalado, sin usar).
export default auth(async (request) => {
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const { pathname } = request.nextUrl;

  // ── Admin session protection ──────────────────────────────────────────────
  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (isProtected) {
    if (!request.auth) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return withSecurityHeaders(NextResponse.redirect(loginUrl), nonce, pathname);
    }
    return withSecurityHeaders(NextResponse.next(), nonce, pathname);
  }

  return withSecurityHeaders(NextResponse.next(), nonce, pathname);
});

export const config = {
  // Broad matcher so CSP nonce is injected on every page.
  // _next/static and _next/image are excluded to avoid unnecessary overhead on asset requests.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
