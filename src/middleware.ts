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
    body{
      font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
      background:#030303;color:#fff;
      min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;
      padding:2rem 1rem;text-align:center;position:relative;overflow:hidden;
    }
    .glow{
      position:fixed;inset:0;pointer-events:none;
      background:radial-gradient(ellipse at top,rgba(34,211,238,0.08),transparent 55%);
    }
    .eyebrow{
      font-size:.7rem;font-weight:700;letter-spacing:.3em;text-transform:uppercase;
      color:#71717a;margin-bottom:1rem;
    }
    .code{
      font-size:clamp(4.5rem,16vw,9rem);font-weight:800;line-height:1;margin-bottom:.5rem;
      background:linear-gradient(to bottom,rgba(255,255,255,0.22),rgba(255,255,255,0.05));
      -webkit-background-clip:text;background-clip:text;color:transparent;user-select:none;
    }
    h1{font-size:1.375rem;font-weight:600;color:#f4f4f5;margin-bottom:.75rem}
    p.desc{color:#71717a;font-size:.9rem;line-height:1.5;max-width:26rem;margin:0 auto 2rem}
    .actions{display:flex;flex-wrap:wrap;gap:.75rem;align-items:center;justify-content:center}
    a{
      display:inline-flex;align-items:center;justify-content:center;height:2.75rem;padding:0 1.5rem;
      border-radius:9999px;font-size:.875rem;font-weight:600;text-decoration:none;
      transition:transform .15s ease,background-color .15s ease,border-color .15s ease;
    }
    a:hover{transform:translateY(-1px)}
    a.primary{background:#f4f4f5;color:#030303;border:1px solid #f4f4f5}
    a.secondary{background:rgba(255,255,255,.05);color:#d4d4d8;border:1px solid rgba(255,255,255,.1)}
    a.accent{background:rgba(34,211,238,.1);color:#22d3ee;border:1px solid rgba(34,211,238,.3)}
    .logo{height:2.5rem;width:2.5rem;margin-bottom:1.5rem}
  </style>
</head>
<body>
  <div class="glow" aria-hidden="true"></div>
  <img class="logo" src="/ptlogox.png" alt="PixelTEC" width="40" height="40" />
  <p class="eyebrow">Error 404</p>
  <p class="code" aria-hidden="true">404</p>
  <h1>Esta página no existe</h1>
  <p class="desc">La URL que buscas no existe o fue movida. Usa los accesos directos para retomar el camino.</p>
  <div class="actions">
    <a class="primary" href="/">Volver al inicio</a>
    <a class="secondary" href="/services">Servicios</a>
    <a class="secondary" href="/industrias">Industrias</a>
    <a class="secondary" href="/blog">Blog</a>
    <a class="accent" href="/contact">Contacto</a>
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
