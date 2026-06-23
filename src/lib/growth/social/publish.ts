import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminApp } from '@/lib/firebase-admin';
import {
  createInstagramMediaContainer,
  publishInstagramMedia,
  publishFacebookPost,
} from './meta-api';
import { getAccessToken } from '../actions/social-accounts';
import type { PublishResult } from '@/types/growth/social';

function db() {
  return getFirestore(getAdminApp());
}

export async function publishPostToAccount(
  postId: string,
  accountId: string,
  uid: string
): Promise<PublishResult> {
  const [postDoc, accountDoc] = await Promise.all([
    db().collection('growthPosts').doc(postId).get(),
    db().collection('growthSocialAccounts').doc(accountId).get(),
  ]);

  if (!postDoc.exists || postDoc.data()?.uid !== uid) {
    return { ok: false, platform: 'instagram', error: 'Post no encontrado' };
  }
  if (!accountDoc.exists || accountDoc.data()?.uid !== uid) {
    return { ok: false, platform: 'instagram', error: 'Cuenta no encontrada' };
  }

  const post = postDoc.data()!;
  const account = accountDoc.data()!;
  const platform = account.platform as 'instagram' | 'facebook';
  const token = await getAccessToken(accountId, uid);
  if (!token) return { ok: false, platform, error: 'Token no disponible' };

  const caption = buildCaption(post.caption as string, post.hashtags as string[]);

  try {
    let publishedId: string;

    if (platform === 'instagram') {
      if (!account.instagramBusinessId) {
        return { ok: false, platform, error: 'Sin cuenta de Instagram Business vinculada' };
      }
      if (!post.imageUrl) {
        return { ok: false, platform, error: 'Instagram requiere imagen para publicar' };
      }

      const containerId = await createInstagramMediaContainer(
        account.instagramBusinessId as string,
        token,
        caption,
        post.imageUrl as string
      );

      // Wait a bit for container to process
      await new Promise((r) => setTimeout(r, 3000));

      publishedId = await publishInstagramMedia(
        account.instagramBusinessId as string,
        token,
        containerId
      );
    } else {
      publishedId = await publishFacebookPost(
        account.facebookPageId as string,
        token,
        caption,
        post.imageUrl as string | undefined
      );
    }

    const publishedUrl = platform === 'instagram'
      ? `https://www.instagram.com/p/${publishedId}/`
      : `https://www.facebook.com/${publishedId}`;

    // Update post status
    await db().collection('growthPosts').doc(postId).update({
      status: 'published',
      publishedAt: FieldValue.serverTimestamp(),
      [`publishedPlatforms.${platform}`]: {
        publishedId,
        publishedUrl,
        publishedAt: Timestamp.now().toDate().toISOString(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { ok: true, platform, publishedId, publishedUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';

    await db().collection('growthPosts').doc(postId).update({
      status: 'failed',
      [`publishErrors.${platform}`]: message,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { ok: false, platform, error: message };
  }
}

function buildCaption(caption: string, hashtags: string[]): string {
  if (!hashtags?.length) return caption;
  return `${caption}\n\n${hashtags.map((h) => `#${h}`).join(' ')}`;
}

export async function publishScheduledPosts(): Promise<{ published: number; failed: number }> {
  const now = Timestamp.now();

  const snap = await db()
    .collection('growthPosts')
    .where('status', '==', 'scheduled')
    .where('scheduledAt', '<=', now)
    .limit(20)
    .get();

  let published = 0;
  let failed = 0;

  for (const doc of snap.docs) {
    const post = doc.data();
    const uid = post.uid as string;

    // Get first connected account for this user
    const accountSnap = await db()
      .collection('growthSocialAccounts')
      .where('uid', '==', uid)
      .where('status', '==', 'connected')
      .limit(1)
      .get();

    if (accountSnap.empty) {
      await doc.ref.update({ status: 'failed', publishErrors: { cron: 'Sin cuenta social conectada' }, updatedAt: FieldValue.serverTimestamp() });
      failed++;
      continue;
    }

    const result = await publishPostToAccount(doc.id, accountSnap.docs[0].id, uid);
    if (result.ok) published++;
    else failed++;
  }

  return { published, failed };
}
