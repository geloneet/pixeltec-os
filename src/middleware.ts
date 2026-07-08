import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { PROTECTED_PATHS, KNOWN_ROUTES } from '@/lib/routes/admin-routes';

export const runtime = 'nodejs';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const crypto = require('crypto') as typeof import('crypto');

// Fase 4: slug de portal validado contra Postgres (antes: Firestore `clients`).
async function isValidPortalSlug(slug: string): Promise<boolean> {
  try {
    const [row] = await db.select({ id: clients.id }).from(clients).where(eq(clients.slug, slug)).limit(1);
    return !!row;
  } catch {
    return true; // Fail open — let [slug]/page.tsx handle it
  }
}

const NOT_FOUND_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex">
  <title>404 — Página no encontrada · PixelTEC</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,-apple-system,sans-serif;background:#050505;color:#fff;
         display:flex;align-items:center;justify-content:center;min-height:100vh}
    .w{text-align:center;padding:2rem;max-width:400px}
    .code{color:#22d3ee;font-size:.7rem;letter-spacing:.3em;font-weight:700;text-transform:uppercase;margin-bottom:.5rem}
    h1{font-size:1.5rem;font-weight:700;margin-bottom:.75rem}
    p{color:#71717a;font-size:.875rem;margin-bottom:1.5rem}
    a{display:inline-block;background:#fff;color:#050505;padding:.5rem 1.5rem;
      border-radius:9999px;font-size:.875rem;font-weight:600;text-decoration:none}
  </style>
</head>
<body>
  <div class="w">
    <p class="code">Error 404</p>
    <h1>Página no encontrada</h1>
    <p>La URL que buscas no existe o fue movida.</p>
    <a href="/">Volver al inicio</a>
  </div>
</body>
</html>`;

// Dominios de terceros con script-src propio (fuera del nonce): Cloudflare Web
// Analytics, inyectado a nivel de edge/proxy.
const THIRD_PARTY_SCRIPT_SRC = [
  'https://static.cloudflareinsights.com',
].join(' ');

function buildCsp(nonce: string): string {
  const scriptSrc = process.env.NODE_ENV === 'development'
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' ${THIRD_PARTY_SCRIPT_SRC}`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${THIRD_PARTY_SCRIPT_SRC}`;
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self'",
    // Permisivo a propósito (https: en vez de una allowlist corta): las
    // actualizaciones del portal de clientes aceptan cualquier URL de imagen
    // válida (src/app/actions.ts, addClientUpdateAction), no solo R2 —
    // restringir aquí rompería esas imágenes silenciosamente.
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    'report-uri /api/csp-report',
    'report-to csp-endpoint',
  ].join('; ');
}

function withSecurityHeaders(res: NextResponse, nonce: string): NextResponse {
  // Enforcing (antes Report-Only): esta es ahora la ÚNICA CSP del sitio — la
  // política estática con 'unsafe-inline'/'unsafe-eval' de next.config.ts se
  // quitó para no tener dos CSP compitiendo (ver next.config.ts).
  res.headers.set('Content-Security-Policy', buildCsp(nonce));
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
      return withSecurityHeaders(NextResponse.redirect(loginUrl), nonce);
    }
    return withSecurityHeaders(NextResponse.next(), nonce);
  }

  // ── Portal slug validation ────────────────────────────────────────────────
  // Only check single-segment paths that look like portal slugs (no dots, no
  // underscores, not a known app route).
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 1) {
    const slug = segments[0];
    if (!slug.includes('.') && !slug.startsWith('_') && !KNOWN_ROUTES.has(slug)) {
      const valid = await isValidPortalSlug(slug);
      if (!valid) {
        const notFound = new NextResponse(NOT_FOUND_HTML, {
          status: 404,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
        return withSecurityHeaders(notFound, nonce);
      }
    }
  }

  return withSecurityHeaders(NextResponse.next(), nonce);
});

export const config = {
  // Broad matcher so CSP nonce is injected on every page.
  // _next/static and _next/image are excluded to avoid unnecessary overhead on asset requests.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
