import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { growthCredits } from '@/lib/db/schema';
import { getSessionUid } from '@/lib/auth/session';
import { resolveOwnerId } from '@/lib/growth/pg';

export async function GET() {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ownerId = await resolveOwnerId(uid);
  const [row] = ownerId
    ? await db.select().from(growthCredits).where(eq(growthCredits.ownerId, ownerId)).limit(1)
    : [];

  if (!row) {
    return NextResponse.json({ balance: 0, plan: 'free', monthlyAllowance: 50 });
  }

  return NextResponse.json({
    balance: row.balance ?? 0,
    plan: row.plan ?? 'free',
    monthlyAllowance: row.monthlyAllowance ?? 50,
    totalUsed: row.totalUsed ?? 0,
  });
}
