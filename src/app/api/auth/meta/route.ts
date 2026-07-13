import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSessionUid } from '@/lib/auth/session';
import { OAUTH_STATE_COOKIE } from '@/lib/growth/social/meta-oauth-state';

const SCOPES = [
  'pages_manage_posts',
  'pages_read_engagement',
  'pages_show_list',
  'instagram_basic',
  'instagram_content_publish',
].join(',');

export async function GET() {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const redirectUri = `${appUrl}/api/auth/meta/callback`;

  // `state` ya NO lleva el uid en claro (un atacante podía mandar el uid de una
  // víctima y el callback vinculaba las páginas de FB/IG del atacante a esa
  // cuenta ajena). Ahora es solo un nonce CSRF de un solo uso, comparado en el
  // callback contra esta cookie httpOnly. El uid en el callback se deriva de la
  // sesión activa, nunca del parámetro `state`.
  const nonce = crypto.randomBytes(32).toString('hex');

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: redirectUri,
    scope: SCOPES,
    response_type: 'code',
    state: nonce,
  });

  const res = NextResponse.redirect(`https://www.facebook.com/v21.0/dialog/oauth?${params}`);
  res.cookies.set(OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60, // 10 minutos — igual que el resto de flujos OAuth cortos del repo
    path: '/api/auth/meta',
  });
  return res;
}
