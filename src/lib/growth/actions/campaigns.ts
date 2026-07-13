'use server';

// Fase 4 (rebanada Growth): Postgres — antes Firestore `growthCampaigns`.
import { and, desc, eq, gte, ne, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { growthBrands, growthCampaigns, growthCredits, growthCreditLedger } from '@/lib/db/schema';
import { getSessionUid } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import { generateText } from '@/lib/growth/ai/providers/openai-text';
import { buildSystemPrompt } from '@/lib/growth/ai/prompt-builder';
import { CREDIT_COSTS } from '@/lib/growth/credits/costs';
import { resolveOwnerId, resolveBrandRow, resolveCampaignRow, publicId } from '@/lib/growth/pg';
import type { Campaign, CampaignStrategy, CampaignPostPlan } from '@/types/growth/campaign';
import type { BrandBrain } from '@/types/growth/brand-brain';

export type CampaignClient = Omit<Campaign, 'createdAt' | 'updatedAt' | 'strategy'> & {
  createdAt: string;
  updatedAt: string;
  strategy?: Omit<CampaignStrategy, 'generatedAt'> & { generatedAt: string };
};

type CampaignRow = typeof growthCampaigns.$inferSelect;

// En jsonb la estrategia guarda `generatedAt` como ISO string.
type StoredStrategy = Omit<CampaignStrategy, 'generatedAt'> & { generatedAt: string };

function serialize(row: CampaignRow): CampaignClient {
  const strategy = row.strategy as StoredStrategy | null;
  return {
    id: publicId(row),
    uid: row.ownerId,
    brandId: row.brandId,
    name: row.name,
    objective: row.objective,
    targetAction: row.targetAction,
    targetPlatforms: row.targetPlatforms as Campaign['targetPlatforms'],
    status: row.status,
    counters: {
      totalPosts: row.totalPosts,
      generatedPosts: row.generatedPosts,
      approvedPosts: row.approvedPosts,
      publishedPosts: row.publishedPosts,
    },
    dateRange:
      row.startDate && row.endDate
        ? ({ startDate: row.startDate, endDate: row.endDate } as unknown as Campaign['dateRange'])
        : undefined,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
    strategy: strategy
      ? { ...strategy, generatedAt: strategy.generatedAt ?? '' }
      : undefined,
  };
}

export async function getCampaigns(brandId?: string): Promise<CampaignClient[]> {
  const uid = await getSessionUid();
  if (!uid) return [];
  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return [];

  const conditions = [eq(growthCampaigns.ownerId, ownerId)];
  if (brandId) {
    const brand = await resolveBrandRow(brandId);
    if (!brand) return [];
    conditions.push(eq(growthCampaigns.brandId, brand.id));
  }

  const rows = await db
    .select()
    .from(growthCampaigns)
    .where(and(...conditions))
    .orderBy(desc(growthCampaigns.createdAt));
  return rows.map(serialize);
}

export async function getCampaign(campaignId: string): Promise<CampaignClient | null> {
  const uid = await getSessionUid();
  if (!uid) return null;
  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return null;
  const row = await resolveCampaignRow(campaignId);
  if (!row || row.ownerId !== ownerId) return null;
  return serialize(row);
}

export async function createCampaign(data: {
  brandId: string;
  name: string;
  objective: string;
  targetAction: string;
  targetPlatforms: Campaign['targetPlatforms'];
  dateRange?: { startDate: string; endDate: string };
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };
  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return { ok: false, error: 'No autenticado' };

  const brand = await resolveBrandRow(data.brandId);
  if (!brand || brand.ownerId !== ownerId) return { ok: false, error: 'Marca no encontrada' };

  const [row] = await db
    .insert(growthCampaigns)
    .values({
      ownerId,
      brandId: brand.id,
      name: data.name,
      objective: data.objective,
      targetAction: data.targetAction,
      targetPlatforms: data.targetPlatforms,
      status: 'planning',
      startDate: data.dateRange?.startDate ?? null,
      endDate: data.dateRange?.endDate ?? null,
    })
    .returning();

  revalidatePath('/crecimiento/campanas');
  return { ok: true, id: publicId(row) };
}

export async function generateCampaignStrategy(
  campaignId: string
): Promise<{ ok: boolean; error?: string }> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };
  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return { ok: false, error: 'No autenticado' };

  const campaignRow = await resolveCampaignRow(campaignId);
  if (!campaignRow || campaignRow.ownerId !== ownerId) {
    return { ok: false, error: 'Campaña no encontrada' };
  }

  const [credits] = await db
    .select({ balance: growthCredits.balance })
    .from(growthCredits)
    .where(eq(growthCredits.ownerId, ownerId))
    .limit(1);

  const balance = credits?.balance ?? 0;
  if (balance < CREDIT_COSTS.campaign_strategy) {
    return { ok: false, error: 'Créditos insuficientes para generar estrategia' };
  }

  // Claim atómico: evita que dos clicks concurrentes disparen dos llamadas a OpenAI
  // para la misma campaña (el débito de créditos ya es transaccional, pero el gasto
  // real de la API ocurre antes de esa transacción). Un solo UPDATE condicional:
  // si otra petición ya la puso en 'generating', afecta 0 filas.
  const claimed = await db
    .update(growthCampaigns)
    .set({ status: 'generating', updatedAt: new Date() })
    .where(and(eq(growthCampaigns.id, campaignRow.id), ne(growthCampaigns.status, 'generating')))
    .returning({ id: growthCampaigns.id });

  if (claimed.length === 0) {
    return { ok: false, error: 'Ya se está generando una estrategia para esta campaña.' };
  }

  // A partir de aquí la campaña quedó marcada 'generating'; cualquier salida debe
  // revertirla para no dejarla atascada si algo falla. (Antes se revertía a
  // 'pending' — valor fuera del enum de status; en Postgres usamos 'planning'.)
  try {
    return await generateStrategyBody(ownerId, campaignRow);
  } catch (err) {
    await db
      .update(growthCampaigns)
      .set({ status: 'planning', updatedAt: new Date() })
      .where(eq(growthCampaigns.id, campaignRow.id))
      .catch(() => {});
    const message = err instanceof Error ? err.message : 'Error interno generando la estrategia';
    return { ok: false, error: message };
  }
}

async function generateStrategyBody(
  ownerId: string,
  campaignRow: CampaignRow
): Promise<{ ok: boolean; error?: string }> {
  const [brandRow] = await db
    .select()
    .from(growthBrands)
    .where(eq(growthBrands.id, campaignRow.brandId))
    .limit(1);
  if (!brandRow) {
    await db
      .update(growthCampaigns)
      .set({ status: 'planning', updatedAt: new Date() })
      .where(eq(growthCampaigns.id, campaignRow.id))
      .catch(() => {});
    return { ok: false, error: 'Marca no encontrada' };
  }

  const brand = {
    id: publicId(brandRow),
    uid: brandRow.ownerId,
    name: brandRow.name,
    identity: brandRow.identity,
    voice: brandRow.voice,
    business: brandRow.business,
    positioning: brandRow.positioning,
    objections: brandRow.objections,
    contentRules: brandRow.contentRules,
  } as BrandBrain;

  const systemPrompt = buildSystemPrompt(brand);
  const userPrompt = `Crea una estrategia de campaña para: "${campaignRow.objective}".
Acción objetivo: ${campaignRow.targetAction}
Plataformas: ${campaignRow.targetPlatforms.join(', ')}

Responde con JSON estricto:
{
  "campaignName": "nombre creativo de la campaña",
  "angle": "ángulo/hook principal de la campaña",
  "targetedPain": "dolor específico que ataca esta campaña",
  "keyMessage": "mensaje central de la campaña (1 oración)",
  "postPlans": [
    {
      "planId": "plan_1",
      "format": "instagram_post",
      "purpose": "awareness",
      "keyMessage": "mensaje específico de este post"
    }
  ],
  "estimatedCredits": 24
}

Genera entre 3 y 6 posts con diferentes propósitos (awareness, consideration, conversion, social_proof).`;

  const result = await generateText({ systemPrompt, userPrompt });

  let strategy: Omit<CampaignStrategy, 'generatedAt'> & { templateId?: string } = {
    campaignName: campaignRow.name,
    angle: '',
    targetedPain: '',
    keyMessage: '',
    postPlans: [],
    estimatedCredits: 0,
  };

  try {
    const cleaned = result.text.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned) as typeof strategy;
    strategy = parsed;
  } catch {
    // Re-lanzado como Error para que el catch de generateCampaignStrategy revierta
    // el status de la campaña a 'planning' (si no, quedaría atascada en 'generating').
    throw new Error('Error al parsear la estrategia de IA');
  }

  const postPlans: CampaignPostPlan[] = (strategy.postPlans as Array<Partial<CampaignPostPlan>>).map((p, i) => ({
    planId: p.planId ?? `plan_${i + 1}`,
    format: (p.format ?? 'instagram_post') as CampaignPostPlan['format'],
    templateId: '',
    purpose: (p.purpose ?? 'awareness') as CampaignPostPlan['purpose'],
    keyMessage: p.keyMessage ?? '',
    status: 'pending',
  }));

  await db.transaction(async (tx) => {
    // Débito atómico: UPDATE condicional sobre balance — si otro proceso gastó
    // los créditos entre el pre-check y aquí, afecta 0 filas y abortamos.
    const debited = await tx
      .update(growthCredits)
      .set({
        balance: sql`${growthCredits.balance} - ${CREDIT_COSTS.campaign_strategy}`,
        totalUsed: sql`${growthCredits.totalUsed} + ${CREDIT_COSTS.campaign_strategy}`,
      })
      .where(
        and(
          eq(growthCredits.ownerId, ownerId),
          gte(growthCredits.balance, CREDIT_COSTS.campaign_strategy)
        )
      )
      .returning({ balance: growthCredits.balance });

    if (debited.length === 0) throw new Error('Créditos insuficientes');

    await tx
      .update(growthCampaigns)
      .set({
        status: 'strategy_ready',
        strategy: {
          ...strategy,
          postPlans,
          estimatedCredits: postPlans.length * CREDIT_COSTS.campaign_post,
          generatedAt: new Date().toISOString(),
        },
        totalPosts: postPlans.length,
        updatedAt: new Date(),
      })
      .where(eq(growthCampaigns.id, campaignRow.id));

    await tx.insert(growthCreditLedger).values({
      ownerId,
      type: 'charge',
      operation: 'campaign_strategy',
      amount: -CREDIT_COSTS.campaign_strategy,
      balance: debited[0].balance,
      description: `Estrategia de campaña: ${campaignRow.name}`,
    });
  });

  revalidatePath(`/crecimiento/campanas/${publicId(campaignRow)}`);
  return { ok: true };
}
