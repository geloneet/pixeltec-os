'use server';

// Fase 4 (rebanada Growth): Postgres — antes Firestore `growthBrands`.
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { growthBrands, growthCredits, growthCreditLedger } from '@/lib/db/schema';
import { getSessionUid } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import { computeBrandScore, isBrandComplete, isBrandUsable } from '@/lib/growth/utils/brand-score';
import { resolveOwnerId, resolveBrandRow, publicId } from '@/lib/growth/pg';
import type { BrandBrain } from '@/types/growth/brand-brain';
import { TRIAL_GRANT_CREDITS } from '@/types/growth/credits';

export type BrandBrainClient = Omit<BrandBrain, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
  completionScore: number;
  isComplete: boolean;
  isUsable: boolean;
};

type BrandRow = typeof growthBrands.$inferSelect;

function serialize(row: BrandRow): BrandBrainClient {
  const data = {
    name: row.name,
    identity: row.identity,
    voice: row.voice,
    business: row.business,
    positioning: row.positioning,
    objections: row.objections,
    contentRules: row.contentRules,
  } as Omit<BrandBrain, 'id' | 'uid' | 'createdAt' | 'updatedAt'>;
  const score = computeBrandScore(data);
  return {
    ...data,
    id: publicId(row),
    uid: row.ownerId,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
    completionScore: score,
    isComplete: isBrandComplete(data),
    isUsable: isBrandUsable(data),
  };
}

async function ensureCredits(ownerId: string) {
  const inserted = await db
    .insert(growthCredits)
    .values({
      ownerId,
      balance: TRIAL_GRANT_CREDITS,
      monthlyAllowance: 50,
      totalPurchased: 0,
      totalUsed: 0,
      plan: 'free',
    })
    .onConflictDoNothing({ target: growthCredits.ownerId })
    .returning({ ownerId: growthCredits.ownerId });

  if (inserted.length > 0) {
    await db.insert(growthCreditLedger).values({
      ownerId,
      type: 'trial_grant',
      amount: TRIAL_GRANT_CREDITS,
      balance: TRIAL_GRANT_CREDITS,
      description: `Créditos de bienvenida`,
    });
  }
}

export async function getBrands(): Promise<BrandBrainClient[]> {
  const uid = await getSessionUid();
  if (!uid) return [];
  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return [];
  const rows = await db
    .select()
    .from(growthBrands)
    .where(eq(growthBrands.ownerId, ownerId))
    .orderBy(desc(growthBrands.createdAt));
  return rows.map(serialize);
}

export async function getBrand(brandId: string): Promise<BrandBrainClient | null> {
  const uid = await getSessionUid();
  if (!uid) return null;
  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return null;
  const row = await resolveBrandRow(brandId);
  if (!row || row.ownerId !== ownerId) return null;
  return serialize(row);
}

export type CreateBrandInput = Omit<BrandBrain, 'id' | 'uid' | 'createdAt' | 'updatedAt' | 'completionScore' | 'isComplete'>;

export async function createBrand(data: CreateBrandInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };
  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return { ok: false, error: 'No autenticado' };

  await ensureCredits(ownerId);

  const [row] = await db
    .insert(growthBrands)
    .values({
      ownerId,
      name: data.name,
      identity: data.identity,
      voice: data.voice,
      business: data.business,
      positioning: data.positioning,
      objections: data.objections,
      contentRules: data.contentRules,
    })
    .returning();

  revalidatePath('/crecimiento/brand-brain');
  revalidatePath('/crecimiento');
  return { ok: true, id: publicId(row) };
}

export async function updateBrand(
  brandId: string,
  data: Partial<CreateBrandInput>
): Promise<{ ok: boolean; error?: string }> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };
  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return { ok: false, error: 'No autenticado' };

  const existing = await resolveBrandRow(brandId);
  if (!existing || existing.ownerId !== ownerId) {
    return { ok: false, error: 'No encontrado' };
  }

  const update: Partial<typeof growthBrands.$inferInsert> = { updatedAt: new Date() };
  if (data.name !== undefined) update.name = data.name;
  if (data.identity !== undefined) update.identity = data.identity;
  if (data.voice !== undefined) update.voice = data.voice;
  if (data.business !== undefined) update.business = data.business;
  if (data.positioning !== undefined) update.positioning = data.positioning;
  if (data.objections !== undefined) update.objections = data.objections;
  if (data.contentRules !== undefined) update.contentRules = data.contentRules;

  await db.update(growthBrands).set(update).where(eq(growthBrands.id, existing.id));

  revalidatePath('/crecimiento/brand-brain');
  revalidatePath(`/crecimiento/brand-brain/${brandId}`);
  return { ok: true };
}

export async function deleteBrand(brandId: string): Promise<{ ok: boolean; error?: string }> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };
  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return { ok: false, error: 'No autenticado' };

  const existing = await resolveBrandRow(brandId);
  if (!existing || existing.ownerId !== ownerId) {
    return { ok: false, error: 'No encontrado' };
  }

  await db.delete(growthBrands).where(eq(growthBrands.id, existing.id));
  revalidatePath('/crecimiento/brand-brain');
  return { ok: true };
}
