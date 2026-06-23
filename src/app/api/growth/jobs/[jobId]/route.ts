import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getAdminApp } from '@/lib/firebase-admin';
import { getSessionUid } from '@/lib/crypto-intel/auth';

function db() {
  return getFirestore(getAdminApp());
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { jobId } = await params;
  const doc = await db().collection('growthJobs').doc(jobId).get();
  if (!doc.exists || doc.data()?.uid !== uid) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const data = doc.data()!;
  return NextResponse.json({
    id: doc.id,
    status: data.status,
    progress: data.progress ?? 0,
    currentStep: data.currentStep ?? '',
    resultPostId: data.resultPostId ?? null,
    error: data.error ?? null,
  });
}
