import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAdminApp } from '@/lib/firebase-admin';
import { getSessionUid } from '@/lib/crypto-intel/auth';

function db() {
  return getFirestore(getAdminApp());
}

export async function GET(req: NextRequest) {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  let query = db()
    .collection('growthPosts')
    .where('uid', '==', uid)
    .where('status', 'in', ['scheduled', 'published'])
    .orderBy('scheduledAt', 'asc');

  if (from) query = query.where('scheduledAt', '>=', Timestamp.fromDate(new Date(from))) as typeof query;
  if (to) query = query.where('scheduledAt', '<=', Timestamp.fromDate(new Date(to))) as typeof query;

  const snap = await query.get();
  const posts = snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate?.()?.toISOString() ?? null,
    updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() ?? null,
    scheduledAt: doc.data().scheduledAt?.toDate?.()?.toISOString() ?? null,
  }));

  return NextResponse.json({ posts });
}
