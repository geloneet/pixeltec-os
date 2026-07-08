import { cookies } from 'next/headers';

/**
 * Sesión del portal LEGADO (`/portal`, Fase D retiro Firebase) — antes
 * Firebase Auth (email/password) vía `useFirebaseUser()`. Mismo mecanismo de
 * cookie firmada HMAC que `src/lib/portal/session-server.ts` (portal OTP
 * `/[slug]`), pero con su propio cookie name/payload: son dos poblaciones y
 * dos flujos de login distintos, no deben compartir sesión.
 */

const COOKIE_NAME = '__portal_legacy_session';
const TTL_SECONDS = 7 * 24 * 60 * 60; // 7 días

let cachedSecret: string | null = null;

function getSecret(): string {
  if (cachedSecret !== null) return cachedSecret;

  const secret = process.env.PORTAL_SESSION_SECRET ?? '';

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'PORTAL_SESSION_SECRET is required in production. ' +
          'Generate with: openssl rand -hex 32',
      );
    }
    console.warn('PORTAL_SESSION_SECRET not set — legacy portal sessions will not work');
  }

  if (secret && secret.length < 32) {
    throw new Error('PORTAL_SESSION_SECRET must be at least 32 characters');
  }

  cachedSecret = secret;
  return secret;
}

interface LegacyPortalSessionPayload {
  clientId: string;
  iat: number;
  exp: number;
}

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

async function sign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return base64url(new Uint8Array(sig));
}

async function verify(data: string, signature: string): Promise<boolean> {
  const expected = await sign(data);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

export async function createLegacyPortalSession(clientId: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const payload: LegacyPortalSessionPayload = { clientId, iat: now, exp: now + TTL_SECONDS };
  const payloadStr = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await sign(payloadStr);
  const value = `${payloadStr}.${sig}`;

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_SECONDS,
  });
}

export async function readLegacyPortalSession(): Promise<LegacyPortalSessionPayload | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return null;

  const dotIndex = cookie.value.lastIndexOf('.');
  if (dotIndex === -1) return null;
  const payloadStr = cookie.value.slice(0, dotIndex);
  const sig = cookie.value.slice(dotIndex + 1);

  const valid = await verify(payloadStr, sig).catch(() => false);
  if (!valid) return null;

  try {
    const payload: LegacyPortalSessionPayload = JSON.parse(
      new TextDecoder().decode(base64urlDecode(payloadStr)),
    );
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function clearLegacyPortalSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
