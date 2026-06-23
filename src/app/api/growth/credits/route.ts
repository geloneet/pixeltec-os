import { NextResponse } from 'next/server';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getAdminApp } from '@/lib/firebase-admin';

export async function GET() {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const snap = await getFirestore(getAdminApp()).collection('growthCredits').doc(uid).get();
  if (!snap.exists) {
    return NextResponse.json({ balance: 0, plan: 'free', monthlyAllowance: 50 });
  }

  const data = snap.data()!;
  return NextResponse.json({
    balance: data.balance ?? 0,
    plan: data.plan ?? 'free',
    monthlyAllowance: data.monthlyAllowance ?? 50,
    totalUsed: data.totalUsed ?? 0,
  });
}
