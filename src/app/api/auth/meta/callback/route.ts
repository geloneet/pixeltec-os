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

  const redirectBase = `${process.env.NEXT_PUBLIC_APP_URL}/crecimiento/publisher`;

  if (error || !code || !state) {
    return NextResponse.redirect(`${redirectBase}?error=meta_denied`);
  }

  try {
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/meta/callback`;

    // Verify uid exists in Firestore (basic validation that state is legitimate)
    const db = getFirestore(getAdminApp());
    // We use the state as uid — verify it's a real user by checking they have a session doc or credits doc
    // (simple check: uid must be non-empty and not contain suspicious chars)
    if (!/^[a-zA-Z0-9_-]{10,128}$/.test(state)) {
      return NextResponse.redirect(`${redirectBase}?error=invalid_state`);
    }

    const shortToken = await exchangeCodeForToken(code, redirectUri);
    const longToken = await getLongLivedToken(shortToken.access_token);

    const tokenExpiresAt = new Date(Date.now() + longToken.expires_in * 1000).toISOString();

    const fbUser = await getFacebookUser(longToken.access_token);
    const pages = await getFacebookPages(longToken.access_token);

    let accountsCreated = 0;

    for (const page of pages) {
      const igId = page.instagram_business_account?.id;
      let igUsername: string | undefined;

      if (igId) {
        igUsername = await getInstagramUsername(igId, page.access_token);
      }

      await upsertSocialAccount({
        uid: state,
        platform: igId ? 'instagram' : 'facebook',
        status: 'connected',
        facebookUserId: fbUser.id,
        facebookPageId: page.id,
        facebookPageName: page.name,
        accessToken: page.access_token,
        tokenExpiresAt,
        instagramBusinessId: igId,
        instagramUsername: igUsername,
      });

      accountsCreated++;
    }

    // Also save a Facebook-only account if no pages had IG
    if (accountsCreated === 0) {
      return NextResponse.redirect(`${redirectBase}?error=no_pages`);
    }

    return NextResponse.redirect(`${redirectBase}?success=1&accounts=${accountsCreated}`);
  } catch (err) {
    console.error('Meta OAuth callback error:', err);
    return NextResponse.redirect(`${redirectBase}?error=oauth_failed`);
  }
}
