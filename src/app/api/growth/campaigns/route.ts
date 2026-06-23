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

  let query = db()
    .collection('growthCampaigns')
    .where('uid', '==', uid)
    .orderBy('createdAt', 'desc')
    .limit(20);

  if (brandId) query = query.where('brandId', '==', brandId) as typeof query;

  const snap = await query.get();
  const campaigns = snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate?.()?.toISOString() ?? null,
    updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() ?? null,
  }));

  return NextResponse.json({ campaigns });
}
