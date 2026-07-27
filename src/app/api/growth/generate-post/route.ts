import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { growthJobs } from '@/lib/db/schema';
import { getSessionUid } from '@/lib/auth/session';
import { getBrand } from '@/lib/growth/actions/brands';
import { runPostGeneration } from '@/lib/growth/ai/orchestrator';
import { resolveOwnerId, resolveBrandRow } from '@/lib/growth/pg';
import { toSafeFailure } from '@/lib/ai/errors';
import type { PostGenerationRequest } from '@/lib/growth/ai/prompt-builder';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as { brandId?: string; request?: PostGenerationRequest };
  const { brandId, request } = body;

  if (!brandId || !request?.objective || !request?.format) {
    return NextResponse.json({ error: 'brandId, objective y format son requeridos' }, { status: 400 });
  }

  const brand = await getBrand(brandId);
  if (!brand) return NextResponse.json({ error: 'Marca no encontrada' }, { status: 404 });

  const brandRow = await resolveBrandRow(brandId);

  const [job] = await db
    .insert(growthJobs)
    .values({
      ownerId,
      brandId: brandRow?.id ?? null,
      type: 'post_generation',
      status: 'queued',
      progress: 0,
      currentStep: 'Iniciando...',
    })
    .returning();

  try {
    const post = await runPostGeneration({
      uid,
      brand: brand as unknown as import('@/types/growth/brand-brain').BrandBrain,
      request,
      jobId: job.id,
    });

    return NextResponse.json({ jobId: job.id, post });
  } catch (err) {
    // El `message` de un error desconocido no se mira: un `APIError` de un SDK
    // cita el cuerpo de la respuesta, y esto se persiste y se devuelve al
    // navegador. Solo cruzan el código estable y un mensaje redactado por
    // nosotros.
    const failure = toSafeFailure(err, 'No se pudo generar el post.');
    await db
      .update(growthJobs)
      .set({ status: 'failed', error: failure.code, updatedAt: new Date() })
      .where(eq(growthJobs.id, job.id));
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: 500 });
  }
}
