'use server';

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAdminApp } from '@/lib/firebase-admin';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { revalidatePath } from 'next/cache';
import { generateText } from '@/lib/growth/ai/providers/openai-text';
import { buildSystemPrompt } from '@/lib/growth/ai/prompt-builder';
import { CREDIT_COSTS } from '@/lib/growth/credits/costs';
import type { Campaign, CampaignStrategy, CampaignPostPlan } from '@/types/growth/campaign';
import type { BrandBrain } from '@/types/growth/brand-brain';

function db() {
  return getFirestore(getAdminApp());
}

export type CampaignClient = Omit<Campaign, 'createdAt' | 'updatedAt' | 'strategy'> & {
  createdAt: string;
  updatedAt: string;
  strategy?: Omit<CampaignStrategy, 'generatedAt'> & { generatedAt: string };
};

function serialize(doc: FirebaseFirestore.DocumentSnapshot): CampaignClient {
  const data = doc.data()!;
  return {
    ...(data as Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>),
    id: doc.id,
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    strategy: data.strategy
      ? { ...data.strategy, generatedAt: data.strategy.generatedAt?.toDate?.()?.toISOString() ?? '' }
      : undefined,
  };
}

export async function getCampaigns(brandId?: string): Promise<CampaignClient[]> {
  const uid = await getSessionUid();
  if (!uid) return [];
  let query = db().collection('growthCampaigns').where('uid', '==', uid).orderBy('createdAt', 'desc');
  if (brandId) query = query.where('brandId', '==', brandId) as typeof query;
  const snap = await query.get();
  return snap.docs.map(serialize);
}

export async function getCampaign(campaignId: string): Promise<CampaignClient | null> {
  const uid = await getSessionUid();
  if (!uid) return null;
  const doc = await db().collection('growthCampaigns').doc(campaignId).get();
  if (!doc.exists || doc.data()?.uid !== uid) return null;
  return serialize(doc);
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

  const ref = db().collection('growthCampaigns').doc();
  await ref.set({
    ...data,
    uid,
    status: 'planning',
    counters: { totalPosts: 0, generatedPosts: 0, approvedPosts: 0, publishedPosts: 0 },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  revalidatePath('/crecimiento/campanas');
  return { ok: true, id: ref.id };
}

export async function generateCampaignStrategy(
  campaignId: string
): Promise<{ ok: boolean; error?: string }> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const [campaignDoc, creditsDoc] = await Promise.all([
    db().collection('growthCampaigns').doc(campaignId).get(),
    db().collection('growthCredits').doc(uid).get(),
  ]);

  if (!campaignDoc.exists || campaignDoc.data()?.uid !== uid) {
    return { ok: false, error: 'Campaña no encontrada' };
  }

  const balance = creditsDoc.data()?.balance ?? 0;
  if (balance < CREDIT_COSTS.campaign_strategy) {
    return { ok: false, error: 'Créditos insuficientes para generar estrategia' };
  }

  // Claim atómico: evita que dos clicks concurrentes disparen dos llamadas a OpenAI
  // para la misma campaña (el débito de créditos ya es transaccional, pero el gasto
  // real de la API ocurre antes de esa transacción).
  const campaignRef = db().collection('growthCampaigns').doc(campaignId);
  try {
    await db().runTransaction(async (tx) => {
      const doc = await tx.get(campaignRef);
      if (!doc.exists) throw new Error('Campaña no encontrada');
      const currentStatus = doc.data()?.status as Campaign['status'] | undefined;
      if (currentStatus === 'generating') {
        throw new Error('CONCURRENT_GENERATION');
      }
      tx.update(campaignRef, { status: 'generating', updatedAt: FieldValue.serverTimestamp() });
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'CONCURRENT_GENERATION') {
      return { ok: false, error: 'Ya se está generando una estrategia para esta campaña.' };
    }
    return { ok: false, error: 'No se pudo iniciar la generación.' };
  }

  const campaign = campaignDoc.data() as Campaign;

  // A partir de aquí la campaña quedó marcada 'generating'; cualquier salida debe
  // revertirla a 'pending' para no dejarla atascada si algo falla.
  try {
    return await generateStrategyBody(uid, campaignId, campaign);
  } catch (err) {
    await campaignRef.update({ status: 'pending', updatedAt: FieldValue.serverTimestamp() }).catch(() => {});
    const message = err instanceof Error ? err.message : 'Error interno generando la estrategia';
    return { ok: false, error: message };
  }
}

async function generateStrategyBody(
  uid: string,
  campaignId: string,
  campaign: Campaign
): Promise<{ ok: boolean; error?: string }> {
  const brandDoc = await db().collection('growthBrands').doc(campaign.brandId).get();
  if (!brandDoc.exists) {
    await db().collection('growthCampaigns').doc(campaignId)
      .update({ status: 'pending', updatedAt: FieldValue.serverTimestamp() }).catch(() => {});
    return { ok: false, error: 'Marca no encontrada' };
  }

  const brand = { id: brandDoc.id, ...brandDoc.data() } as BrandBrain;

  const systemPrompt = buildSystemPrompt(brand);
  const userPrompt = `Crea una estrategia de campaña para: "${campaign.objective}".
Acción objetivo: ${campaign.targetAction}
Plataformas: ${campaign.targetPlatforms.join(', ')}

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
    campaignName: campaign.name,
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
    // el status de la campaña a 'pending' (si no, quedaría atascada en 'generating').
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

  await db().runTransaction(async (tx) => {
    const credRef = db().collection('growthCredits').doc(uid);
    const cred = await tx.get(credRef);
    const bal = cred.data()?.balance ?? 0;
    if (bal < CREDIT_COSTS.campaign_strategy) throw new Error('Créditos insuficientes');
    tx.update(credRef, {
      balance: FieldValue.increment(-CREDIT_COSTS.campaign_strategy),
      totalUsed: FieldValue.increment(CREDIT_COSTS.campaign_strategy),
    });
    tx.update(db().collection('growthCampaigns').doc(campaignId), {
      status: 'strategy_ready',
      strategy: {
        ...strategy,
        postPlans,
        estimatedCredits: postPlans.length * CREDIT_COSTS.campaign_post,
        generatedAt: FieldValue.serverTimestamp(),
      },
      'counters.totalPosts': postPlans.length,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await db().collection('growthCreditLedger').add({
    uid,
    type: 'debit',
    operation: 'campaign_strategy',
    amount: -CREDIT_COSTS.campaign_strategy,
    description: `Estrategia de campaña: ${campaign.name}`,
    createdAt: FieldValue.serverTimestamp(),
  });

  revalidatePath(`/crecimiento/campanas/${campaignId}`);
  return { ok: true };
}
