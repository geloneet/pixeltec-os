'use server';

// Fase 4 (rebanada Growth): Postgres — antes Firestore `growthSocialAccounts`.
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { growthSocialAccounts } from '@/lib/db/schema';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { revalidatePath } from 'next/cache';
import { resolveOwnerId, resolveSocialAccountRow, publicId } from '@/lib/growth/pg';
import type { SocialAccount } from '@/types/growth/social';

export type SocialAccountClient = Omit<SocialAccount, 'createdAt' | 'updatedAt' | 'accessToken'> & {
  createdAt: string;
  updatedAt: string;
};

type AccountRow = typeof growthSocialAccounts.$inferSelect;

function serialize(row: AccountRow): SocialAccountClient {
  return {
    id: publicId(row),
    uid: row.ownerId,
    platform: row.platform as SocialAccount['platform'],
    status: row.status,
    facebookUserId: row.facebookUserId,
    facebookPageId: row.facebookPageId,
    facebookPageName: row.facebookPageName,
    tokenExpiresAt: row.tokenExpiresAt?.toISOString() ?? '',
    instagramBusinessId: row.instagramBusinessId ?? undefined,
    instagramUsername: row.instagramUsername ?? undefined,
    createdAt: row.createdAt?.toISOString() ?? '',
    updatedAt: row.updatedAt?.toISOString() ?? '',
  };
}

export async function getSocialAccounts(): Promise<SocialAccountClient[]> {
  const uid = await getSessionUid();
  if (!uid) return [];
  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return [];
  const rows = await db
    .select()
    .from(growthSocialAccounts)
    .where(eq(growthSocialAccounts.ownerId, ownerId))
    .orderBy(desc(growthSocialAccounts.createdAt));
  return rows.map(serialize);
}

export async function disconnectSocialAccount(accountId: string): Promise<{ ok: boolean; error?: string }> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };
  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return { ok: false, error: 'No autenticado' };

  const row = await resolveSocialAccountRow(accountId);
  if (!row || row.ownerId !== ownerId) return { ok: false, error: 'No encontrado' };

  await db.delete(growthSocialAccounts).where(eq(growthSocialAccounts.id, row.id));
  revalidatePath('/crecimiento/publisher');
  return { ok: true };
}

export async function getAccessToken(accountId: string, uid: string): Promise<string | null> {
  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return null;
  const row = await resolveSocialAccountRow(accountId);
  if (!row || row.ownerId !== ownerId) return null;
  return row.accessToken;
}

export async function upsertSocialAccount(data: Omit<SocialAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ownerId = await resolveOwnerId(data.uid);
  if (!ownerId) throw new Error('Usuario no encontrado para el uid de sesión');

  const values = {
    ownerId,
    platform: data.platform,
    status: data.status,
    facebookUserId: data.facebookUserId,
    facebookPageId: data.facebookPageId,
    facebookPageName: data.facebookPageName,
    accessToken: data.accessToken,
    tokenExpiresAt: new Date(data.tokenExpiresAt),
    ...(data.instagramBusinessId !== undefined ? { instagramBusinessId: data.instagramBusinessId } : {}),
    ...(data.instagramUsername !== undefined ? { instagramUsername: data.instagramUsername } : {}),
  };

  const [existing] = await db
    .select()
    .from(growthSocialAccounts)
    .where(
      and(
        eq(growthSocialAccounts.ownerId, ownerId),
        eq(growthSocialAccounts.facebookPageId, data.facebookPageId),
        eq(growthSocialAccounts.platform, data.platform)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(growthSocialAccounts)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(growthSocialAccounts.id, existing.id));
    return publicId(existing);
  }

  const [row] = await db.insert(growthSocialAccounts).values(values).returning();
  return publicId(row);
}
