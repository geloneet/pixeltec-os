import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { PROTECTED_PATHS, KNOWN_ROUTES } from '@/lib/routes/admin-routes';

export const runtime = 'nodejs';

const SESSION_COOKIE_NAME = '__session';

async function isValidPortalSlug(slug: string): Promise<boolean> {
  try {
    const snap = await getAdminFirestore()
      .collection('clients')
      .where('slug', '==', slug)
      .limit(1)
      .get();
    return !snap.empty;
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Admin session protection ──────────────────────────────────────────────
  // PROTECTED_PATHS is derived from ADMIN_ROUTES in src/lib/routes/admin-routes.ts
  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (isProtected) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionCookie) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    try {
      await getAdminAuth().verifySessionCookie(sessionCookie, /* checkRevoked */ true);
      return NextResponse.next();
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';

      if (code.startsWith('auth/')) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        loginUrl.searchParams.set('error', 'session_expired');
        return NextResponse.redirect(loginUrl);
      }

      // Infrastructure error — fail open
      console.error('[middleware] session verify infrastructure error:', err);
      return NextResponse.next();
    }
  }

  // ── Portal slug validation ────────────────────────────────────────────────
  // Only check single-segment paths that look like portal slugs (no dots, no
  // underscores, not a known app route).
  // KNOWN_ROUTES is derived from ADMIN_ROUTES in src/lib/routes/admin-routes.ts
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 1) {
    const slug = segments[0];
    if (!slug.includes('.') && !slug.startsWith('_') && !KNOWN_ROUTES.has(slug)) {
      const valid = await isValidPortalSlug(slug);
      if (!valid) {
        return new NextResponse(NOT_FOUND_HTML, {
          status: 404,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // ── Admin routes ─────────────────────────────────────────────────────────
    // Must mirror ADMIN_ROUTES in src/lib/routes/admin-routes.ts.
    // Next.js requires a static literal array here — dynamic spreads are not
    // evaluated at build time. When adding a route to ADMIN_ROUTES, add the
    // corresponding '/<route>/:path*' pattern here too.
    '/dashboard/:path*',
    '/hoy/:path*',
    '/asistente/:path*',
    '/asistente',           // explicit root — belt-and-suspenders for :path* zero-segment edge
    '/clientes/:path*',
    '/proyectos/:path*',
    '/herramientas/:path*',
    '/vps/:path*',
    '/portal/:path*',
    '/crypto-intel/:path*',
    '/perfil/:path*',
    '/notificaciones/:path*',
    '/blog-admin/:path*',
    // ── Single-segment paths — portal slug validation ─────────────────────
    '/:slug',
  ],
};
