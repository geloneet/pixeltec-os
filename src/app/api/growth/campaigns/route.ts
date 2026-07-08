import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { growthCampaigns } from '@/lib/db/schema';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { resolveOwnerId, resolveBrandRow, serializeCampaignRow } from '@/lib/growth/pg';

export async function GET(req: NextRequest) {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return NextResponse.json({ campaigns: [] });

  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get('brandId');

  const conditions = [eq(growthCampaigns.ownerId, ownerId)];
  if (brandId) {
    const brand = await resolveBrandRow(brandId);
    if (!brand) return NextResponse.json({ campaigns: [] });
    conditions.push(eq(growthCampaigns.brandId, brand.id));
  }

  const rows = await db
    .select()
    .from(growthCampaigns)
    .where(and(...conditions))
    .orderBy(desc(growthCampaigns.createdAt))
    .limit(20);

  return NextResponse.json({ campaigns: rows.map(serializeCampaignRow) });
}
