// Fase 4 (rebanada Growth): Postgres — antes Firestore `growthJobs`,
// `growthCredits`, `growthCreditLedger` y `growthPosts`.
import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { growthJobs, growthPosts, growthCredits, growthCreditLedger } from '@/lib/db/schema';
import { generateText } from './providers/openai-text';
import { generateFluxImage } from './providers/flux-image';
import { SafeUserError, toSafeFailure } from '@/lib/ai/errors';
import { buildSystemPrompt, buildUserPrompt, buildImagePrompt, type PostGenerationRequest } from './prompt-builder';
import { CREDIT_COSTS, type CreditOperation } from '@/lib/growth/credits/costs';
import { resolveOwnerId, resolveBrandRow } from '@/lib/growth/pg';
import type { BrandBrain } from '@/types/growth/brand-brain';
import type { ContentPost, BrandSnapshot } from '@/types/growth/post';

export interface OrchestratorInput {
  uid: string;
  brand: BrandBrain;
  request: PostGenerationRequest;
  jobId: string;
}

async function deductCredits(ownerId: string, operation: CreditOperation): Promise<void> {
  const amount = CREDIT_COSTS[operation];

  // Débito atómico: UPDATE condicional (`balance >= amount`) en una sola
  // sentencia — si otra petición concurrente gastó el saldo, afecta 0 filas.
  const debited = await db
    .update(growthCredits)
    .set({
      balance: sql`${growthCredits.balance} - ${amount}`,
      totalUsed: sql`${growthCredits.totalUsed} + ${amount}`,
    })
    .where(and(eq(growthCredits.ownerId, ownerId), gte(growthCredits.balance, amount)))
    .returning({ balance: growthCredits.balance });

  if (debited.length === 0) {
    const [account] = await db
      .select({ balance: growthCredits.balance })
      .from(growthCredits)
      .where(eq(growthCredits.ownerId, ownerId))
      .limit(1);
    if (!account) throw new SafeUserError('Sin cuenta de créditos', 'no_credit_account');
    throw new SafeUserError(
      `Créditos insuficientes. Necesitas ${amount}, tienes ${account.balance}.`,
      'insufficient_credits'
    );
  }

  await db.insert(growthCreditLedger).values({
    ownerId,
    type: 'charge',
    operation,
    amount: -amount,
    balance: debited[0].balance,
    description: `Generación: ${operation}`,
  });
}

/** Devuelve créditos ya cobrados cuando la generación falla o entrega menos de lo cobrado. */
async function refundCredits(ownerId: string, amount: number, reason: string): Promise<void> {
  if (amount <= 0) return;

  const refunded = await db
    .update(growthCredits)
    .set({
      balance: sql`${growthCredits.balance} + ${amount}`,
      totalUsed: sql`${growthCredits.totalUsed} - ${amount}`,
    })
    .where(eq(growthCredits.ownerId, ownerId))
    .returning({ balance: growthCredits.balance });

  if (refunded.length === 0) return; // nada que reembolsar si la cuenta desapareció

  await db.insert(growthCreditLedger).values({
    ownerId,
    type: 'refund',
    amount,
    balance: refunded[0].balance,
    description: reason,
  });
}

type JobUpdate = Partial<Pick<typeof growthJobs.$inferInsert, 'status' | 'progress' | 'currentStep' | 'resultPostId' | 'error'>>;

async function updateJob(jobId: string, update: JobUpdate) {
  await db
    .update(growthJobs)
    .set({ ...update, updatedAt: new Date() })
    .where(eq(growthJobs.id, jobId));
}

function determineCreditOp(request: PostGenerationRequest): CreditOperation {
  if (request.withImage) return 'post_complete';
  return 'post_text_only';
}

export async function runPostGeneration(input: OrchestratorInput): Promise<ContentPost> {
  const { uid, brand, request, jobId } = input;

  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) throw new SafeUserError('Usuario no encontrado para el uid de sesión', 'user_not_found');

  // `brand.id` es el id público (Firestore id para marcas migradas) — el FK
  // growth_posts.brand_id necesita el uuid de Postgres de la fila.
  const brandRow = await resolveBrandRow(brand.id);
  if (!brandRow || brandRow.ownerId !== ownerId) throw new SafeUserError('Marca no encontrada', 'brand_not_found');

  await updateJob(jobId, { status: 'running', progress: 10, currentStep: 'Verificando créditos...' });

  const operation = determineCreditOp(request);
  await deductCredits(ownerId, operation);

  await updateJob(jobId, { progress: 25, currentStep: 'Generando texto...' });

  const system = buildSystemPrompt(brand);
  const user = buildUserPrompt(request);
  let textResult: Awaited<ReturnType<typeof generateText>>;
  try {
    textResult = await generateText({ systemPrompt: system, userPrompt: user });
  } catch (err) {
    // La generación falló después de cobrar créditos — reembolsar el cobro completo.
    await refundCredits(ownerId, CREDIT_COSTS[operation], `Reembolso: fallo en generación de texto (${operation})`);
    throw err;
  }

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
      // Solo estructura: el objeto del proveedor puede citar el prompt de imagen
      // o el cuerpo de la respuesta, y de aquí acabaría en logs y trazas.
      const failure = toSafeFailure(err, 'Fallo en generación de imagen');
      console.error(
        `Image generation failed (${failure.code}${failure.status !== undefined ? `, status ${failure.status}` : ''}), continuing text-only`
      );
      // Se cobró `post_complete` (incluye imagen) pero el usuario solo recibe texto —
      // reembolsar el delta contra el costo de solo-texto.
      const delta = CREDIT_COSTS.post_complete - CREDIT_COSTS.post_text_only;
      await refundCredits(ownerId, delta, 'Reembolso: fallo en generación de imagen (entregado text-only)');
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

  const generationMetadata = {
    model: textResult.model,
    operation,
    // `objective` vivía como campo top-level del documento Firestore; en
    // Postgres no hay columna dedicada (nadie lo consulta) — se preserva aquí.
    objective: request.objective,
    creditsUsed: CREDIT_COSTS[operation],
    actualApiCost: {
      textCost: textResult.cost,
      imageCost,
      totalCost: textResult.cost + imageCost,
    },
  };

  const [postRow] = await db
    .insert(growthPosts)
    .values({
      ownerId,
      brandId: brandRow.id,
      brandSnapshot: snapshot,
      format: request.format,
      caption: parsed.caption ?? '',
      hashtags: parsed.hashtags ?? [],
      imageUrl: imageUrl ?? null,
      altText: parsed.altText ?? null,
      suggestedTime: parsed.suggestedTime ?? null,
      status: 'draft',
      generationMetadata,
    })
    .returning();

  await updateJob(jobId, {
    status: 'completed',
    progress: 100,
    currentStep: 'Listo',
    resultPostId: postRow.id,
  });

  return {
    id: postRow.id,
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
    createdAt: postRow.createdAt,
    updatedAt: postRow.updatedAt,
  };
}
