/**
 * Auth session endpoint.
 *
 * Security layers (in order of execution on POST):
 *   1. CORS origin check (allowlist)
 *   2. IP rate-limit (10/h per IP, shared bucket)
 *   3. Email brute-force lockout (exponential backoff)
 *   4. CAPTCHA verification (currently no-op, ready for activation)
 *   5. Firebase ID token verification
 *   6. Session cookie creation (5d default, 30d if rememberMe)
 *
 * Note on session duration: Firebase Admin's createSessionCookie has a
 * hard 14-day maximum. When rememberMe=true we create a 14-day session
 * cookie inside a 30-day HTTP cookie — when the inner session expires,
 * middleware will force re-auth even if the cookie is still valid.
 * This is intentional: forces token rotation while keeping UX smooth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { enforceRateLimit, formatRetryAfter } from '@/lib/rate-limit';
import {
  isEmailLocked,
  recordAuthFailure,
  clearAuthFailures,
} from '@/lib/auth-brute-force';
import { captcha } from '@/lib/captcha';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SESSION_COOKIE_NAME = '__session';
const SESSION_MAX_AGE_SHORT = 60 * 60 * 24 * 5;   // 5 days  — default
const SESSION_MAX_AGE_LONG = 60 * 60 * 24 * 30;   // 30 days — rememberMe HTTP cookie
const FIREBASE_MAX_SESSION = 60 * 60 * 24 * 14;   // 14 days — Firebase hard ceiling

const ALLOWED_ORIGINS: string[] = [
  'https://pixeltec.mx',
  'https://www.pixeltec.mx',
  ...(process.env.NODE_ENV === 'development'
    ? ['http://localhost:3000', 'http://localhost:9002']
    : []),
];

const SECURITY_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  Pragma: 'no-cache',
  'X-Content-Type-Options': 'nosniff',
} as const;

/** Build CORS headers for a given origin. Caller must have already validated it. */
function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function jsonResponse(
  body: unknown,
  status: number,
  origin: string | null
): NextResponse {
  const headers: Record<string, string> = { ...SECURITY_HEADERS };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    Object.assign(headers, corsHeaders(origin));
  }
  return NextResponse.json(body, { status, headers });
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

/**
 * Decode a Firebase ID token's payload without verifying the signature.
 * Used only to surface the `email` claim early for brute-force tracking
 * before we run the real `verifyIdToken`. Untrusted by design.
 */
function unsafeDecodeIdTokenEmail(idToken: string): string | null {
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );
    return typeof payload?.email === 'string' ? payload.email : null;
  } catch {
    return null;
  }
}

interface SessionPostBody {
  idToken?: unknown;
  rememberMe?: unknown;
  captchaToken?: unknown;
}

/** OPTIONS — CORS preflight. */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return new NextResponse(null, { status: 403, headers: SECURITY_HEADERS });
  }
  return new NextResponse(null, {
    status: 204,
    headers: { ...SECURITY_HEADERS, ...corsHeaders(origin) },
  });
}

/** POST — Create a session cookie from a Firebase ID token. */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');

  // 1) CORS allowlist
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return jsonResponse({ error: 'Forbidden origin' }, 403, null);
  }

  const ip = getClientIp(request);

  // 2) IP rate-limit (10 / hour / IP)
  const rl = await enforceRateLimit({
    bucket: 'auth_session',
    ip,
    max: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.allowed) {
    return jsonResponse(
      {
        error: 'Demasiados intentos. Intenta de nuevo más tarde.',
        retryAfter: formatRetryAfter(rl.retryAfterSec),
      },
      429,
      origin
    );
  }

  // Parse body
  let body: SessionPostBody;
  try {
    body = (await request.json()) as SessionPostBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400, origin);
  }

  const idToken = typeof body.idToken === 'string' ? body.idToken : null;
  const rememberMe = typeof body.rememberMe === 'boolean' ? body.rememberMe : false;
  const captchaToken =
    typeof body.captchaToken === 'string' ? body.captchaToken : undefined;

  if (!idToken) {
    return jsonResponse({ error: 'Missing idToken' }, 400, origin);
  }

  // 3) Email brute-force lockout — done with the untrusted email claim
  //    so we can short-circuit before any heavier work. The email is
  //    re-verified later via verifyIdToken.
  const claimedEmail = unsafeDecodeIdTokenEmail(idToken);
  if (claimedEmail) {
    const lockout = await isEmailLocked(claimedEmail);
    if (lockout.locked) {
      return jsonResponse(
        {
          error: 'Cuenta bloqueada temporalmente por intentos fallidos.',
          retryAfter: lockout.retryAfter,
        },
        429,
        origin
      );
    }
  }

  // 4) CAPTCHA (no-op until a provider is wired)
  const captchaResult = await captcha.verify(captchaToken, ip);
  if (!captchaResult.success) {
    if (claimedEmail) await recordAuthFailure(claimedEmail);
    return jsonResponse(
      { error: 'Verificación de CAPTCHA fallida.', reason: captchaResult.reason },
      403,
      origin
    );
  }

  try {
    const adminAuth = getAdminAuth();

    // 5) Verify the ID token (real signature check)
    const decoded = await adminAuth.verifyIdToken(idToken);
    const verifiedEmail = decoded.email ?? claimedEmail ?? null;

    // 6) Create session cookie
    const sessionDurationSec = rememberMe ? FIREBASE_MAX_SESSION : SESSION_MAX_AGE_SHORT;
    const cookieMaxAgeSec = rememberMe ? SESSION_MAX_AGE_LONG : SESSION_MAX_AGE_SHORT;

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: sessionDurationSec * 1000,
    });

    // Reset failure counter on successful auth
    if (verifiedEmail) {
      await clearAuthFailures(verifiedEmail);
    }

    const response = jsonResponse({ success: true }, 200, origin);
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      maxAge: cookieMaxAgeSec,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[auth/session] verifyIdToken failed:', error);
    if (claimedEmail) await recordAuthFailure(claimedEmail);
    return jsonResponse({ error: 'Unauthorized' }, 401, origin);
  }
}

/** DELETE — Clear the session cookie. */
export async function DELETE(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return jsonResponse({ error: 'Forbidden origin' }, 403, null);
  }

  const response = jsonResponse({ success: true }, 200, origin);
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  return response;
}
