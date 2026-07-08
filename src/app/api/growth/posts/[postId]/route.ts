import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { growthPosts } from '@/lib/db/schema';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { resolveOwnerId, resolvePostRow, serializePostRow } from '@/lib/growth/pg';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ownerId = await resolveOwnerId(uid);
  const { postId } = await params;
  const row = await resolvePostRow(postId);
  if (!row || !ownerId || row.ownerId !== ownerId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(serializePostRow(row));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ownerId = await resolveOwnerId(uid);
  const { postId } = await params;
  const row = await resolvePostRow(postId);
  if (!row || !ownerId || row.ownerId !== ownerId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = (await req.json()) as {
    caption?: string;
    hashtags?: string[];
    scheduledAt?: string | null;
    status?: string;
  };

  const update: Partial<typeof growthPosts.$inferInsert> = { updatedAt: new Date() };
  if (body.caption !== undefined) update.caption = body.caption;
  if (body.hashtags !== undefined) update.hashtags = body.hashtags;
  if (body.status !== undefined) update.status = body.status as typeof growthPosts.$inferInsert.status;
  if (body.scheduledAt !== undefined) {
    update.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
    if (body.scheduledAt) update.status = 'scheduled';
  }

  await db.update(growthPosts).set(update).where(eq(growthPosts.id, row.id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ownerId = await resolveOwnerId(uid);
  const { postId } = await params;
  const row = await resolvePostRow(postId);
  if (!row || !ownerId || row.ownerId !== ownerId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await db.delete(growthPosts).where(eq(growthPosts.id, row.id));
  return NextResponse.json({ ok: true });
}
