import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';

const SESSION_COOKIE_NAME = '__session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 5; // 5 days in seconds

/**
 * POST /api/auth/session — Create a session cookie from a Firebase ID token.
 */
export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json(
        { error: 'Missing idToken' },
        { status: 400 }
      );
    }

    const adminAuth = getAdminAuth();

    // Verify the ID token first
    await adminAuth.verifyIdToken(idToken);

    // Create a session cookie
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE * 1000, // expects milliseconds
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      maxAge: SESSION_MAX_AGE,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Session creation failed:', error);
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
}

/**
 * DELETE /api/auth/session — Clear the session cookie.
 */
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  return response;
}
