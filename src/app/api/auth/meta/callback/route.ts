import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSessionUserId } from '@/lib/auth/session';
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getFacebookUser,
  getFacebookPages,
  getInstagramUsername,
} from '@/lib/growth/social/meta-api';
import { upsertSocialAccount } from '@/lib/growth/actions/social-accounts';
import { OAUTH_STATE_COOKIE } from '@/lib/growth/social/meta-oauth-state';
import { toRouteFailure } from '@/lib/errors/route-failure';

/**
 * Códigos de error OAuth2 (RFC 6749 §4.1.2.1). Es una lista cerrada a
 * propósito: `?error=` lo escribe Meta, y cualquier valor fuera de esta lista
 * es texto libre de un tercero que no tiene por qué acabar en nuestra URL.
 */
const OAUTH_ERROR_CODES = new Set([
  'invalid_request',
  'unauthorized_client',
  'access_denied',
  'unsupported_response_type',
  'invalid_scope',
  'server_error',
  'temporarily_unavailable',
]);

function oauthErrorCode(error: string | null): string {
  if (!error) return 'missing_params';
  return OAUTH_ERROR_CODES.has(error) ? error : 'oauth_failed';
}

function isValidCsrfState(req: NextRequest, state: string): boolean {
  const expected = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!expected) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(state);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // nonce CSRF — ver route.ts
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const redirectBase = `${process.env.NEXT_PUBLIC_APP_URL}/crecimiento/publisher`;

  console.log('[meta/callback] received', { code: !!code, state: !!state, error, errorDescription });

  if (error || !code || !state) {
    // `error` y `error_description` los escribe Meta: son texto libre de un
    // tercero. Se registran en el servidor —ahí sí sirven— pero no se
    // reflejan: `meta_desc` los depositaba en la URL, y una URL de redirect
    // acaba en el historial del navegador, en los logs de acceso de nginx y en
    // la cabecera `Referer` hacia terceros. Sólo viaja un código de la lista
    // cerrada de OAuth2.
    console.error('[meta/callback] denied or missing params:', { error, errorDescription });
    return NextResponse.redirect(
      `${redirectBase}?meta_error=${encodeURIComponent(oauthErrorCode(error))}`
    );
  }

  // El uid SIEMPRE se deriva de la sesión activa — nunca del parámetro `state`
  // que viene del cliente. Antes `state` era el uid en claro, validado solo con
  // un regex de formato, lo que permitía a cualquiera vincular sus propias
  // páginas de Facebook/Instagram a la cuenta de otra persona (account takeover).
  const uid = await getSessionUserId();
  if (!uid) {
    console.error('[meta/callback] no hay sesión activa al recibir el callback');
    return NextResponse.redirect(`${redirectBase}?meta_error=no_session`);
  }

  if (!isValidCsrfState(req, state)) {
    console.error('[meta/callback] state CSRF inválido o ausente');
    return NextResponse.redirect(`${redirectBase}?meta_error=invalid_state`);
  }

  try {
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/meta/callback`;

    console.log('[meta/callback] exchanging code for token...');
    const shortToken = await exchangeCodeForToken(code, redirectUri);
    console.log('[meta/callback] short token ok, getting long-lived...');

    const longToken = await getLongLivedToken(shortToken.access_token);
    console.log('[meta/callback] long-lived token ok, expires_in:', longToken.expires_in);

    // expires_in puede ser undefined en apps de desarrollo; default 60 días
    const expiresIn = longToken.expires_in ?? 60 * 24 * 60 * 60;
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const fbUser = await getFacebookUser(longToken.access_token);
    console.log('[meta/callback] fb user:', fbUser.id, fbUser.name);

    const pages = await getFacebookPages(longToken.access_token);
    console.log('[meta/callback] pages found:', pages.length, pages.map(p => ({ id: p.id, name: p.name })));

    if (pages.length === 0) {
      console.warn('[meta/callback] no pages returned — user may have no FB Pages or permissions missing');
      return NextResponse.redirect(`${redirectBase}?meta_error=no_pages`);
    }

    let accountsCreated = 0;

    for (const page of pages) {
      const igId = page.instagram_business_account?.id;
      let igUsername: string | undefined;

      if (igId) {
        igUsername = await getInstagramUsername(igId, page.access_token);
        console.log('[meta/callback] IG linked:', igId, igUsername);
      } else {
        console.log('[meta/callback] page', page.name, 'has no IG linked');
      }

      const base = {
        uid,
        status: 'connected' as const,
        facebookUserId: fbUser.id,
        facebookPageId: page.id,
        facebookPageName: page.name,
        accessToken: page.access_token,
        tokenExpiresAt,
      };

      // Siempre guarda el Facebook Page
      await upsertSocialAccount({ ...base, platform: 'facebook' });
      accountsCreated++;
      console.log('[meta/callback] saved FB page:', page.name);

      // Si tiene Instagram vinculado, también guarda la cuenta de IG
      if (igId) {
        await upsertSocialAccount({
          ...base,
          platform: 'instagram',
          instagramBusinessId: igId,
          instagramUsername: igUsername,
        });
        accountsCreated++;
        console.log('[meta/callback] saved IG account:', igUsername);
      }
    }

    console.log('[meta/callback] done, accounts saved:', accountsCreated);
    const res = NextResponse.redirect(`${redirectBase}?meta_connected=${accountsCreated}`);
    res.cookies.delete(OAUTH_STATE_COOKIE); // nonce de un solo uso
    return res;

  } catch (err) {
    // El error entero se registra en el servidor, que es donde es útil. A la
    // URL sólo va un código estable: este `catch` cubre las cinco llamadas a
    // Graph API y los `upsertSocialAccount`, así que un fallo de Drizzle
    // acababa citando SQL en la barra de direcciones del usuario.
    console.error('[meta/callback] error:', err);
    const failure = toRouteFailure(err, {
      code: 'oauth_failed',
      message: 'No se pudo completar la conexión con Meta.',
      status: 500,
    });
    return NextResponse.redirect(
      `${redirectBase}?meta_error=${encodeURIComponent(failure.code)}`
    );
  }
}
