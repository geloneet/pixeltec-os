import { NextRequest, NextResponse } from 'next/server';

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
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
