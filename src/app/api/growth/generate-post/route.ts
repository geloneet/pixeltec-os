import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAdminApp } from '@/lib/firebase-admin';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { getBrand } from '@/lib/growth/actions/brands';
import { runPostGeneration } from '@/lib/growth/ai/orchestrator';
import type { PostGenerationRequest } from '@/lib/growth/ai/prompt-builder';

export const maxDuration = 60;

function db() {
  return getFirestore(getAdminApp());
}

export async function POST(req: NextRequest) {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as { brandId?: string; request?: PostGenerationRequest };
  const { brandId, request } = body;

  if (!brandId || !request?.objective || !request?.format) {
    return NextResponse.json({ error: 'brandId, objective y format son requeridos' }, { status: 400 });
  }

  const brand = await getBrand(brandId);
  if (!brand) return NextResponse.json({ error: 'Marca no encontrada' }, { status: 404 });

  const jobRef = db().collection('growthJobs').doc();
  await jobRef.set({
    uid,
    brandId,
    type: 'post_generation',
    status: 'queued',
    progress: 0,
    currentStep: 'Iniciando...',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  try {
    const post = await runPostGeneration({
      uid,
      brand: brand as unknown as import('@/types/growth/brand-brain').BrandBrain,
      request,
      jobId: jobRef.id,
    });

    return NextResponse.json({ jobId: jobRef.id, post });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    await jobRef.update({ status: 'failed', error: message, updatedAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
