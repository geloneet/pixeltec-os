'use server';

// Fase 4 (rebanada Growth): Postgres — antes Firestore `growthSocialAccounts`.
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { growthSocialAccounts } from '@/lib/db/schema';
import { getSessionUserId } from '@/lib/auth/session';
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
  const uid = await getSessionUserId();
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
  const uid = await getSessionUserId();
  if (!uid) return { ok: false, error: 'No autenticado' };
  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return { ok: false, error: 'No autenticado' };

  const row = await resolveSocialAccountRow(accountId);
  if (!row || row.ownerId !== ownerId) return { ok: false, error: 'No encontrado' };

  await db.delete(growthSocialAccounts).where(eq(growthSocialAccounts.id, row.id));
  revalidatePath('/crecimiento/publisher');
  return { ok: true };
}

// `getAccessToken(accountId, uid)` vivía aquí y se eliminó: tomaba la identidad
// de un PARÁMETRO en vez de la sesión, en un archivo 'use server' — es decir,
// era un endpoint RPC que devolvía el access token OAuth de Meta en claro de
// la cuenta de cualquier uid que el llamador escribiera. No tenía un solo
// caller en el repo. Si alguna vez se necesita, debe derivar el uid con
// getSessionUserId() como el resto de este archivo.

export async function upsertSocialAccount(data: Omit<SocialAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  // La identidad SIEMPRE sale de la sesión, nunca del payload: al ser export
  // de 'use server', aceptar `data.uid` permitía inyectar una cuenta social
  // (con su access token) en el Growth Suite de otro usuario.
  const uid = await getSessionUserId();
  if (!uid) throw new Error('No autenticado');
  const ownerId = await resolveOwnerId(uid);
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
