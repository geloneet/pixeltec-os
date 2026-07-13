import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { growthPosts } from '@/lib/db/schema';
import { getSessionUid } from '@/lib/auth/session';
import { resolveOwnerId, serializePostRow } from '@/lib/growth/pg';

export async function GET(req: NextRequest) {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return NextResponse.json({ posts: [] });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const conditions = [
    eq(growthPosts.ownerId, ownerId),
    inArray(growthPosts.status, ['scheduled', 'published']),
  ];
  if (from) conditions.push(gte(growthPosts.scheduledAt, new Date(from)));
  if (to) conditions.push(lte(growthPosts.scheduledAt, new Date(to)));

  const rows = await db
    .select()
    .from(growthPosts)
    .where(and(...conditions))
    .orderBy(asc(growthPosts.scheduledAt));

  return NextResponse.json({ posts: rows.map(serializePostRow) });
}
