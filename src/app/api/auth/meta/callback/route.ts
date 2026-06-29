import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getAdminApp } from '@/lib/firebase-admin';
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getFacebookUser,
  getFacebookPages,
  getInstagramUsername,
} from '@/lib/growth/social/meta-api';
import { upsertSocialAccount } from '@/lib/growth/actions/social-accounts';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // uid
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const redirectBase = `${process.env.NEXT_PUBLIC_APP_URL}/crecimiento/publisher`;

  console.log('[meta/callback] received', { code: !!code, state: !!state, error, errorDescription });

  if (error || !code || !state) {
    console.error('[meta/callback] denied or missing params:', { error, errorDescription });
    return NextResponse.redirect(
      `${redirectBase}?meta_error=${encodeURIComponent(error ?? 'missing_params')}&meta_desc=${encodeURIComponent(errorDescription ?? '')}`
    );
  }

  try {
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/meta/callback`;

    if (!/^[a-zA-Z0-9_-]{10,128}$/.test(state)) {
      console.error('[meta/callback] invalid state:', state);
      return NextResponse.redirect(`${redirectBase}?meta_error=invalid_state`);
    }

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
        uid: state,
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
    return NextResponse.redirect(`${redirectBase}?meta_connected=${accountsCreated}`);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[meta/callback] error:', message);
    return NextResponse.redirect(
      `${redirectBase}?meta_error=oauth_failed&meta_desc=${encodeURIComponent(message)}`
    );
  }
}
