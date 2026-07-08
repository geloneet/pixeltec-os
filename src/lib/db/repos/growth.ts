/**
 * Repos del Growth Suite (brands/posts/campaigns/credits) — Postgres/Drizzle.
 * Ver src/lib/db/schema.ts. Código nuevo, aislado — NO conectado a rutas
 * reales todavía (Fase 0+1).
 */
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  growthBrands,
  growthPosts,
  growthCampaigns,
  growthCredits,
  growthCreditLedger,
  type NewGrowthBrand,
} from "@/lib/db/schema";

// ─── Brands ───────────────────────────────────────────────────────────────

export function getBrandsByOwner(ownerId: string) {
  return db.select().from(growthBrands).where(eq(growthBrands.ownerId, ownerId)).orderBy(desc(growthBrands.createdAt));
}

export function getBrandById(brandId: string, ownerId: string) {
  return db
    .select()
    .from(growthBrands)
    .where(eq(growthBrands.id, brandId))
    .limit(1)
    .then((rows) => (rows[0]?.ownerId === ownerId ? rows[0] : null));
}

export function createBrand(data: NewGrowthBrand) {
  return db.insert(growthBrands).values(data).returning().then((rows) => rows[0]);
}

// ─── Posts ────────────────────────────────────────────────────────────────

export function getPostsByBrand(brandId: string, limit = 20) {
  return db.select().from(growthPosts).where(eq(growthPosts.brandId, brandId)).orderBy(desc(growthPosts.createdAt)).limit(limit);
}

// ─── Campaigns ────────────────────────────────────────────────────────────

export function getCampaignsByBrand(brandId: string) {
  return db.select().from(growthCampaigns).where(eq(growthCampaigns.brandId, brandId)).orderBy(desc(growthCampaigns.createdAt));
}

// ─── Credits ──────────────────────────────────────────────────────────────
// Nota (bug corregido en la auditoría de seguridad): el débito debe hacerse
// DESPUÉS del éxito de la generación (o con reembolso en el catch), nunca
// antes — ver orchestrator.ts / campaigns.ts en el código Firestore actual.

export function getCreditSummary(ownerId: string) {
  return db
    .select()
    .from(growthCredits)
    .where(eq(growthCredits.ownerId, ownerId))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export async function debitCredits(ownerId: string, amount: number, description: string) {
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(growthCredits).where(eq(growthCredits.ownerId, ownerId)).limit(1);
    if (!current || current.balance < amount) {
      throw new Error(`Créditos insuficientes. Necesitas ${amount}, tienes ${current?.balance ?? 0}.`);
    }
    const newBalance = current.balance - amount;
    await tx
      .update(growthCredits)
      .set({ balance: newBalance, totalUsed: current.totalUsed + amount })
      .where(eq(growthCredits.ownerId, ownerId));
    await tx.insert(growthCreditLedger).values({
      ownerId,
      type: "charge",
      amount: -amount,
      balance: newBalance,
      description,
    });
    return newBalance;
  });
}
