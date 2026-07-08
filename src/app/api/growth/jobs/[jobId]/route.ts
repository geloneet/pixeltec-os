import { NextRequest, NextResponse } from 'next/server';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { resolveOwnerId, resolveJobRow, publicId } from '@/lib/growth/pg';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ownerId = await resolveOwnerId(uid);
  const { jobId } = await params;
  const row = await resolveJobRow(jobId);
  if (!row || !ownerId || row.ownerId !== ownerId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: publicId(row),
    status: row.status,
    progress: row.progress ?? 0,
    currentStep: row.currentStep ?? '',
    resultPostId: row.resultPostId ?? null,
    error: row.error ?? null,
  });
}
