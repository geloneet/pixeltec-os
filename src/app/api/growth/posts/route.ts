import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getAdminApp } from '@/lib/firebase-admin';
import { getSessionUid } from '@/lib/crypto-intel/auth';

function db() {
  return getFirestore(getAdminApp());
}

export async function GET(req: NextRequest) {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get('brandId');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50);

  let query = db()
    .collection('growthPosts')
    .where('uid', '==', uid)
    .orderBy('createdAt', 'desc')
    .limit(limit);

  if (brandId) query = query.where('brandId', '==', brandId);

  const snap = await query.get();
  const posts = snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate?.()?.toISOString() ?? null,
    updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() ?? null,
  }));

  return NextResponse.json({ posts });
}
