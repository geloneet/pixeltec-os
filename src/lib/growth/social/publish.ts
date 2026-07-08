// Fase 4 (rebanada Growth): Postgres — antes Firestore `growthPosts` y
// `growthSocialAccounts`.
import { and, eq, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { growthPosts, growthSocialAccounts } from '@/lib/db/schema';
import {
  createInstagramMediaContainer,
  publishInstagramMedia,
  publishFacebookPost,
} from './meta-api';
import { resolveOwnerId, resolvePostRow, resolveSocialAccountRow } from '../pg';
import type { PublishResult } from '@/types/growth/social';

type PostRow = typeof growthPosts.$inferSelect;
type AccountRow = typeof growthSocialAccounts.$inferSelect;

export async function publishPostToAccount(
  postId: string,
  accountId: string,
  uid: string
): Promise<PublishResult> {
  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return { ok: false, platform: 'instagram', error: 'Post no encontrado' };

  const [post, account] = await Promise.all([
    resolvePostRow(postId),
    resolveSocialAccountRow(accountId),
  ]);

  if (!post || post.ownerId !== ownerId) {
    return { ok: false, platform: 'instagram', error: 'Post no encontrado' };
  }
  if (!account || account.ownerId !== ownerId) {
    return { ok: false, platform: 'instagram', error: 'Cuenta no encontrada' };
  }

  return publishRowToAccount(post, account);
}

async function publishRowToAccount(post: PostRow, account: AccountRow): Promise<PublishResult> {
  const platform = account.platform as 'instagram' | 'facebook';
  const token = account.accessToken;
  if (!token) return { ok: false, platform, error: 'Token no disponible' };

  const caption = buildCaption(post.caption, post.hashtags);

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
        account.instagramBusinessId,
        token,
        caption,
        post.imageUrl
      );

      // Wait a bit for container to process
      await new Promise((r) => setTimeout(r, 3000));

      publishedId = await publishInstagramMedia(
        account.instagramBusinessId,
        token,
        containerId
      );
    } else {
      publishedId = await publishFacebookPost(
        account.facebookPageId,
        token,
        caption,
        post.imageUrl ?? undefined
      );
    }

    const publishedUrl = platform === 'instagram'
      ? `https://www.instagram.com/p/${publishedId}/`
      : `https://www.facebook.com/${publishedId}`;

    // Update post status
    const publishedAt = new Date();
    await db
      .update(growthPosts)
      .set({
        status: 'published',
        publishedAt,
        publishedPlatforms: {
          ...(post.publishedPlatforms as Record<string, unknown>),
          [platform]: {
            publishedId,
            publishedUrl,
            publishedAt: publishedAt.toISOString(),
          },
        },
        updatedAt: new Date(),
      })
      .where(eq(growthPosts.id, post.id));

    return { ok: true, platform, publishedId, publishedUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';

    await db
      .update(growthPosts)
      .set({
        status: 'failed',
        publishErrors: {
          ...(post.publishErrors as Record<string, unknown>),
          [platform]: message,
        },
        updatedAt: new Date(),
      })
      .where(eq(growthPosts.id, post.id));

    return { ok: false, platform, error: message };
  }
}

function buildCaption(caption: string, hashtags: string[]): string {
  if (!hashtags?.length) return caption;
  return `${caption}\n\n${hashtags.map((h) => `#${h}`).join(' ')}`;
}

export async function publishScheduledPosts(): Promise<{ published: number; failed: number }> {
  const now = new Date();

  const posts = await db
    .select()
    .from(growthPosts)
    .where(and(eq(growthPosts.status, 'scheduled'), lte(growthPosts.scheduledAt, now)))
    .limit(20);

  let published = 0;
  let failed = 0;

  for (const post of posts) {
    // Get first connected account for this user
    const [account] = await db
      .select()
      .from(growthSocialAccounts)
      .where(
        and(
          eq(growthSocialAccounts.ownerId, post.ownerId),
          eq(growthSocialAccounts.status, 'connected')
        )
      )
      .limit(1);

    if (!account) {
      await db
        .update(growthPosts)
        .set({
          status: 'failed',
          publishErrors: { cron: 'Sin cuenta social conectada' },
          updatedAt: new Date(),
        })
        .where(eq(growthPosts.id, post.id));
      failed++;
      continue;
    }

    const result = await publishRowToAccount(post, account);
    if (result.ok) published++;
    else failed++;
  }

  return { published, failed };
}
