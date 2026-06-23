'use server';

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAdminApp } from '@/lib/firebase-admin';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { revalidatePath } from 'next/cache';
import { computeBrandScore, isBrandComplete, isBrandUsable } from '@/lib/growth/utils/brand-score';
import type { BrandBrain } from '@/types/growth/brand-brain';
import { TRIAL_GRANT_CREDITS } from '@/types/growth/credits';

function db() {
  return getFirestore(getAdminApp());
}

export type BrandBrainClient = Omit<BrandBrain, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
  completionScore: number;
  isComplete: boolean;
  isUsable: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serialize(doc: FirebaseFirestore.DocumentSnapshot): BrandBrainClient {
  const data = doc.data()!;
  const score = computeBrandScore(data);
  return {
    ...(data as Omit<BrandBrain, 'id' | 'createdAt' | 'updatedAt'>),
    id: doc.id,
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    completionScore: score,
    isComplete: isBrandComplete(data),
    isUsable: isBrandUsable(data),
  };
}

async function ensureCredits(uid: string) {
  const ref = db().collection('growthCredits').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      balance: TRIAL_GRANT_CREDITS,
      monthlyAllowance: 50,
      totalPurchased: 0,
      totalUsed: 0,
      plan: 'free',
      createdAt: FieldValue.serverTimestamp(),
    });
    await db().collection('growthCreditLedger').add({
      uid,
      type: 'trial_grant',
      amount: TRIAL_GRANT_CREDITS,
      balance: TRIAL_GRANT_CREDITS,
      description: `Créditos de bienvenida`,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}

export async function getBrands(): Promise<BrandBrainClient[]> {
  const uid = await getSessionUid();
  if (!uid) return [];
  const snap = await db()
    .collection('growthBrands')
    .where('uid', '==', uid)
    .orderBy('createdAt', 'desc')
    .get();
  return snap.docs.map(serialize);
}

export async function getBrand(brandId: string): Promise<BrandBrainClient | null> {
  const uid = await getSessionUid();
  if (!uid) return null;
  const doc = await db().collection('growthBrands').doc(brandId).get();
  if (!doc.exists || doc.data()?.uid !== uid) return null;
  return serialize(doc);
}

export type CreateBrandInput = Omit<BrandBrain, 'id' | 'uid' | 'createdAt' | 'updatedAt' | 'completionScore' | 'isComplete'>;

export async function createBrand(data: CreateBrandInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  await ensureCredits(uid);

  const ref = db().collection('growthBrands').doc();
  await ref.set({
    ...data,
    uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  revalidatePath('/crecimiento/brand-brain');
  revalidatePath('/crecimiento');
  return { ok: true, id: ref.id };
}

export async function updateBrand(
  brandId: string,
  data: Partial<CreateBrandInput>
): Promise<{ ok: boolean; error?: string }> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const existing = await db().collection('growthBrands').doc(brandId).get();
  if (!existing.exists || existing.data()?.uid !== uid) {
    return { ok: false, error: 'No encontrado' };
  }

  await db().collection('growthBrands').doc(brandId).update({
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  });

  revalidatePath('/crecimiento/brand-brain');
  revalidatePath(`/crecimiento/brand-brain/${brandId}`);
  return { ok: true };
}

export async function deleteBrand(brandId: string): Promise<{ ok: boolean; error?: string }> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const existing = await db().collection('growthBrands').doc(brandId).get();
  if (!existing.exists || existing.data()?.uid !== uid) {
    return { ok: false, error: 'No encontrado' };
  }

  await db().collection('growthBrands').doc(brandId).delete();
  revalidatePath('/crecimiento/brand-brain');
  return { ok: true };
}
