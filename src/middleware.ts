import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { PROTECTED_PATHS, KNOWN_ROUTES } from '@/lib/routes/admin-routes';

export const runtime = 'nodejs';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const crypto = require('crypto') as typeof import('crypto');

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

const FIREBASE_AUTH_DOMAIN = 'studio-1487114664-78b63.firebaseapp.com';

function buildCsp(nonce: string): string {
  const scriptSrc = process.env.NODE_ENV === 'development'
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    [
      "connect-src 'self'",
      'https://identitytoolkit.googleapis.com',
      'https://securetoken.googleapis.com',
      'https://firestore.googleapis.com',
      'wss://firestore.googleapis.com',
      `https://${FIREBASE_AUTH_DOMAIN}`,
    ].join(' '),
    "img-src 'self' data: blob: https://lh3.googleusercontent.com https://firebasestorage.googleapis.com https://storage.googleapis.com",
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
  res.headers.set('Content-Security-Policy-Report-Only', buildCsp(nonce));
  res.headers.set('Reporting-Endpoints', 'csp-endpoint="/api/csp-report"');
  res.headers.set('x-nonce', nonce);
  return res;
}

export async function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const { pathname } = request.nextUrl;

  // ── Admin session protection ──────────────────────────────────────────────
  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (isProtected) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionCookie) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return withSecurityHeaders(NextResponse.redirect(loginUrl), nonce);
    }

    try {
      await getAdminAuth().verifySessionCookie(sessionCookie, /* checkRevoked */ true);
      return withSecurityHeaders(NextResponse.next(), nonce);
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';

      if (code.startsWith('auth/')) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        loginUrl.searchParams.set('error', 'session_expired');
        return withSecurityHeaders(NextResponse.redirect(loginUrl), nonce);
      }

      // Infrastructure error — fail open
      console.error('[middleware] session verify infrastructure error:', err);
      return withSecurityHeaders(NextResponse.next(), nonce);
    }
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
}

export const config = {
  // Broad matcher so CSP nonce is injected on every page.
  // _next/static and _next/image are excluded to avoid unnecessary overhead on asset requests.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
