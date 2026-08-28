import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { PROTECTED_PATHS } from '@/lib/routes/admin-routes';
import { decideRestrictedAccess, isRestrictedRole } from '@/lib/routes/reviewer-access';
import { cspForPath } from '@/lib/security/csp';

export const runtime = 'nodejs';

import crypto from 'node:crypto';

function withSecurityHeaders(res: NextResponse, nonce: string, pathname: string): NextResponse {
  // Enforcing (antes Report-Only): esta es ahora la ÚNICA CSP del sitio — la
  // política estática con 'unsafe-inline'/'unsafe-eval' de next.config.ts se
  // quitó para no tener dos CSP compitiendo (ver next.config.ts).
  //
  // La construcción de la CSP y los matchers por-ruta viven en
  // `@/lib/security/csp` (funciones puras, testeadas sin DB ni auth):
  // `frame-src 'self'` es GLOBAL e incondicional (la CSP es per-documento,
  // no sobrevive la navegación cliente de una SPA); lo que sí es por-ruta es
  // `frame-ancestors` — la ruta de "Imprimir" (proposal-pdf) y el preview de
  // PixelForge declaran `frame-ancestors 'self'`, el resto del sitio 'none'.
  res.headers.set('Content-Security-Policy', cspForPath(nonce, pathname));
  res.headers.set('Reporting-Endpoints', 'csp-endpoint="/api/csp-report"');
  res.headers.set('x-nonce', nonce);
  return res;
}

/**
 * 403 del rol restringido (WO-2026-00051). Server-side, antes de cualquier
 * page/route handler: aplica igual a la navegación por URL directa, a los
 * fetch de `/api/*` y a los POST de server actions. Documento HTML mínimo para
 * navegaciones, JSON para todo lo demás — sin detalles internos.
 */
function forbiddenForRestrictedRole(request: Request, nonce: string, pathname: string): NextResponse {
  const wantsHtml = (request.headers.get('accept') ?? '').includes('text/html');
  const res = wantsHtml
    ? new NextResponse(
        '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>403 · PixelTEC OS</title></head>' +
          '<body style="font-family:system-ui;margin:3rem"><h1>403 — Sin acceso</h1>' +
          '<p>Esta cuenta solo puede usar el módulo de WhatsApp.</p>' +
          '<p><a href="/whatsapp">Ir a WhatsApp</a></p></body></html>',
        { status: 403, headers: { 'content-type': 'text/html; charset=utf-8' } }
      )
    : NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return withSecurityHeaders(res, nonce, pathname);
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

  // ── Rol restringido (reviewer, WO-2026-00051): deny-by-default ───────────
  // Solo con sesión. El rol viene del JWT, que el callback `jwt` refresca desde
  // Postgres en cada request (ADR-0036); las rutas de la allowlist vuelven a
  // resolver la autoridad en la base (`requireWhatsAppReviewAccess`). Un rol
  // ausente o desconocido se trata como restringido (fail-closed). Admin y
  // staff no entran aquí: su comportamiento es el de siempre.
  if (request.auth && isRestrictedRole(request.auth.user?.role)) {
    const decision = decideRestrictedAccess({
      pathname,
      method: request.method,
      isServerAction: request.headers.has('next-action'),
    });
    if (decision.kind === 'deny') {
      return forbiddenForRestrictedRole(request, nonce, pathname);
    }
    if (decision.kind === 'redirect') {
      return withSecurityHeaders(
        NextResponse.redirect(new URL(decision.to, request.url)),
        nonce,
        pathname
      );
    }
    // 'allow' → sigue la protección general de sesión de abajo.
  }

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
