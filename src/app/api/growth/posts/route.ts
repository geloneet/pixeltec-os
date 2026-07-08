import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { growthPosts } from '@/lib/db/schema';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { resolveOwnerId, resolveBrandRow, serializePostRow } from '@/lib/growth/pg';

export async function GET(req: NextRequest) {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return NextResponse.json({ posts: [] });

  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get('brandId');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50);

  const conditions = [eq(growthPosts.ownerId, ownerId)];
  if (brandId) {
    const brand = await resolveBrandRow(brandId);
    if (!brand) return NextResponse.json({ posts: [] });
    conditions.push(eq(growthPosts.brandId, brand.id));
  }

  const rows = await db
    .select()
    .from(growthPosts)
    .where(and(...conditions))
    .orderBy(desc(growthPosts.createdAt))
    .limit(limit);

  return NextResponse.json({ posts: rows.map(serializePostRow) });
}
