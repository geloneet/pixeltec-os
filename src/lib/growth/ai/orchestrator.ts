import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAdminApp } from '@/lib/firebase-admin';
import { generateText } from './providers/openai-text';
import { generateFluxImage } from './providers/flux-image';
import { buildSystemPrompt, buildUserPrompt, buildImagePrompt, type PostGenerationRequest } from './prompt-builder';
import { CREDIT_COSTS, type CreditOperation } from '@/lib/growth/credits/costs';
import type { BrandBrain } from '@/types/growth/brand-brain';
import type { ContentPost, BrandSnapshot } from '@/types/growth/post';

function db() {
  return getFirestore(getAdminApp());
}

export interface OrchestratorInput {
  uid: string;
  brand: BrandBrain;
  request: PostGenerationRequest;
  jobId: string;
}

async function deductCredits(uid: string, operation: CreditOperation): Promise<void> {
  const amount = CREDIT_COSTS[operation];
  const ref = db().collection('growthCredits').doc(uid);

  await db().runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) throw new Error('Sin cuenta de créditos');
    const balance = doc.data()!.balance as number;
    if (balance < amount) throw new Error(`Créditos insuficientes. Necesitas ${amount}, tienes ${balance}.`);
    tx.update(ref, { balance: FieldValue.increment(-amount), totalUsed: FieldValue.increment(amount) });
  });

  await db().collection('growthCreditLedger').add({
    uid,
    type: 'debit',
    operation,
    amount: -amount,
    description: `Generación: ${operation}`,
    createdAt: FieldValue.serverTimestamp(),
  });
}

async function updateJob(jobId: string, update: Record<string, unknown>) {
  await db().collection('growthJobs').doc(jobId).update({
    ...update,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

function determineCreditOp(request: PostGenerationRequest): CreditOperation {
  if (request.withImage) return 'post_complete';
  return 'post_text_only';
}

export async function runPostGeneration(input: OrchestratorInput): Promise<ContentPost> {
  const { uid, brand, request, jobId } = input;

  await updateJob(jobId, { status: 'running', progress: 10, currentStep: 'Verificando créditos...' });

  const operation = determineCreditOp(request);
  await deductCredits(uid, operation);

  await updateJob(jobId, { progress: 25, currentStep: 'Generando texto...' });

  const system = buildSystemPrompt(brand);
  const user = buildUserPrompt(request);
  const textResult = await generateText({ systemPrompt: system, userPrompt: user });

  let parsed: {
    caption?: string;
    hashtags?: string[];
    imagePrompt?: string;
    altText?: string;
    suggestedTime?: string;
  } = {};

  try {
    const cleaned = textResult.text.replace(/```json\n?|\n?```/g, '').trim();
    parsed = JSON.parse(cleaned) as typeof parsed;
  } catch {
    parsed = { caption: textResult.text, hashtags: [] };
  }

  await updateJob(jobId, { progress: 60, currentStep: request.withImage ? 'Generando imagen...' : 'Finalizando...' });

  let imageUrl: string | undefined;
  let imageCost = 0;

  if (request.withImage && parsed.imagePrompt) {
    try {
      const imagePrompt = buildImagePrompt(parsed.caption ?? '', brand, parsed.imagePrompt);
      const imageResult = await generateFluxImage({ prompt: imagePrompt });
      imageUrl = imageResult.imageUrl;
      imageCost = imageResult.cost;
    } catch (err) {
      console.error('Image generation failed, continuing text-only:', err);
    }
  }

  await updateJob(jobId, { progress: 85, currentStep: 'Guardando post...' });

  const snapshot: BrandSnapshot = {
    id: brand.id,
    name: brand.name,
    industry: brand.business.industry,
    voiceSummary: brand.voice.personality.slice(0, 3).join(', '),
    primaryColor: brand.identity?.colors?.primary,
    logoUrl: brand.identity?.logoUrl,
  };

  const postRef = db().collection('growthPosts').doc();
  const postData = {
    uid,
    brandId: brand.id,
    brandSnapshot: snapshot,
    format: request.format,
    objective: request.objective,
    caption: parsed.caption ?? '',
    hashtags: parsed.hashtags ?? [],
    imageUrl,
    altText: parsed.altText,
    suggestedTime: parsed.suggestedTime,
    status: 'draft',
    generationMetadata: {
      model: textResult.model,
      operation,
      creditsUsed: CREDIT_COSTS[operation],
      actualApiCost: {
        textCost: textResult.cost,
        imageCost,
        totalCost: textResult.cost + imageCost,
      },
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await postRef.set(postData);

  await updateJob(jobId, {
    status: 'completed',
    progress: 100,
    currentStep: 'Listo',
    resultPostId: postRef.id,
  });

  return {
    id: postRef.id,
    uid,
    brandId: brand.id,
    brandSnapshot: snapshot,
    format: request.format,
    caption: parsed.caption ?? '',
    hashtags: parsed.hashtags ?? [],
    imageUrl,
    altText: parsed.altText,
    suggestedTime: parsed.suggestedTime,
    status: 'draft',
    generationMetadata: {
      model: textResult.model,
      operation,
      creditsUsed: CREDIT_COSTS[operation],
      actualApiCost: { textCost: textResult.cost, imageCost, totalCost: textResult.cost + imageCost },
    },
    createdAt: null as unknown as import('firebase-admin/firestore').Timestamp,
    updatedAt: null as unknown as import('firebase-admin/firestore').Timestamp,
  };
}
