import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SESSION_COOKIE_NAME = '__session';

const SECURITY_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  Pragma: 'no-cache',
  'X-Content-Type-Options': 'nosniff',
} as const;

/**
 * POST /api/auth/revoke
 *
 * Revokes all refresh tokens for the authenticated user, invalidating
 * all active sessions across all devices. Then clears the __session cookie.
 *
 * Called by the "Sign out everywhere" feature in Seguridad settings.
 */
export async function POST(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return NextResponse.json(
      { error: 'No active session' },
      { status: 401, headers: SECURITY_HEADERS }
    );
  }

  try {
    const adminAuth = getAdminAuth();

    // Verify the session cookie to get the uid (checkRevoked=true ensures it's still valid)
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const uid = decoded.uid;

    // Revoke all refresh tokens — invalidates all sessions on all devices
    await adminAuth.revokeRefreshTokens(uid);

    // Clear the __session cookie
    const response = NextResponse.json(
      { ok: true },
      { status: 200, headers: SECURITY_HEADERS }
    );
    response.cookies.set(SESSION_COOKIE_NAME, '', {
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[auth/revoke] failed:', error);
    return NextResponse.json(
      { error: 'Failed to revoke sessions' },
      { status: 500, headers: SECURITY_HEADERS }
    );
  }
}
