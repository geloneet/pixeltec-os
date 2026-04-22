import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

const SESSION_COOKIE_NAME = '__session';

const PROTECTED_PATHS = [
  '/dashboard',
  '/hoy',
  '/clientes',
  '/proyectos',
  '/herramientas',
  '/vps',
  '/portal',
  '/crypto-intel',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

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
      // Cookie inválida, expirada o revocada → forzar re-login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      loginUrl.searchParams.set('error', 'session_expired');
      return NextResponse.redirect(loginUrl);
    }

    // Error de infraestructura (red, Firebase temporalmente no disponible)
    // → fail-open para no bloquear usuarios durante incidentes de Firebase
    console.error('[middleware] session verify infrastructure error:', err);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/hoy/:path*',
    '/clientes/:path*',
    '/proyectos/:path*',
    '/herramientas/:path*',
    '/vps/:path*',
    '/portal/:path*',
    '/crypto-intel/:path*',
  ],
};
