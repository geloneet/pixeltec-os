'use server';

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAdminApp } from '@/lib/firebase-admin';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { revalidatePath } from 'next/cache';
import type { SocialAccount } from '@/types/growth/social';

function db() {
  return getFirestore(getAdminApp());
}

export type SocialAccountClient = Omit<SocialAccount, 'createdAt' | 'updatedAt' | 'accessToken'> & {
  createdAt: string;
  updatedAt: string;
};

function serialize(doc: FirebaseFirestore.DocumentSnapshot): SocialAccountClient {
  const d = doc.data()!;
  return {
    id: doc.id,
    uid: d.uid,
    platform: d.platform,
    status: d.status,
    facebookUserId: d.facebookUserId,
    facebookPageId: d.facebookPageId,
    facebookPageName: d.facebookPageName,
    tokenExpiresAt: d.tokenExpiresAt,
    instagramBusinessId: d.instagramBusinessId,
    instagramUsername: d.instagramUsername,
    createdAt: d.createdAt?.toDate?.()?.toISOString() ?? '',
    updatedAt: d.updatedAt?.toDate?.()?.toISOString() ?? '',
  };
}

export async function getSocialAccounts(): Promise<SocialAccountClient[]> {
  const uid = await getSessionUid();
  if (!uid) return [];
  const snap = await db()
    .collection('growthSocialAccounts')
    .where('uid', '==', uid)
    .get();
  return snap.docs
    .map(serialize)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function disconnectSocialAccount(accountId: string): Promise<{ ok: boolean; error?: string }> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const doc = await db().collection('growthSocialAccounts').doc(accountId).get();
  if (!doc.exists || doc.data()?.uid !== uid) return { ok: false, error: 'No encontrado' };

  await doc.ref.delete();
  revalidatePath('/crecimiento/publisher');
  return { ok: true };
}

export async function getAccessToken(accountId: string, uid: string): Promise<string | null> {
  const doc = await db().collection('growthSocialAccounts').doc(accountId).get();
  if (!doc.exists || doc.data()?.uid !== uid) return null;
  return doc.data()!.accessToken as string;
}

export async function upsertSocialAccount(data: Omit<SocialAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const db_ = db();

  // Firestore no acepta undefined — eliminar campos opcionales no presentes
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  ) as typeof data;

  const existing = await db_
    .collection('growthSocialAccounts')
    .where('uid', '==', data.uid)
    .where('facebookPageId', '==', data.facebookPageId)
    .where('platform', '==', data.platform)
    .limit(1)
    .get();

  if (!existing.empty) {
    const ref = existing.docs[0].ref;
    await ref.update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
    return ref.id;
  }

  const ref = db_.collection('growthSocialAccounts').doc();
  await ref.set({ ...clean, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  return ref.id;
}
