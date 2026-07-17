import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { PROTECTED_PATHS } from '@/lib/routes/admin-routes';
import { cspForPath } from '@/lib/security/csp';

export const runtime = 'nodejs';

import crypto from 'node:crypto';

function withSecurityHeaders(res: NextResponse, nonce: string, pathname: string): NextResponse {
  // Enforcing (antes Report-Only): esta es ahora la ÚNICA CSP del sitio — la
  // política estática con 'unsafe-inline'/'unsafe-eval' de next.config.ts se
  // quitó para no tener dos CSP compitiendo (ver next.config.ts).
  //
  // La construcción de la CSP y los matchers por-ruta viven en
  // `@/lib/security/csp` (funciones puras, testeadas sin DB ni auth): la ruta
  // de "Imprimir" (proposal-pdf) conserva `frame-ancestors 'self'`; el preview
  // de PixelForge se declara embebible y sus páginas admin embedder relajan
  // `frame-src` a 'self' SOLO bajo `/proyectos/pixelforge`.
  res.headers.set('Content-Security-Policy', cspForPath(nonce, pathname));
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
