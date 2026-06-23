import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminApp } from '@/lib/firebase-admin';
import { getSessionUid } from '@/lib/crypto-intel/auth';

function db() {
  return getFirestore(getAdminApp());
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { postId } = await params;
  const doc = await db().collection('growthPosts').doc(postId).get();
  if (!doc.exists || doc.data()?.uid !== uid) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const data = doc.data()!;
  return NextResponse.json({
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? null,
    scheduledAt: data.scheduledAt?.toDate?.()?.toISOString() ?? null,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { postId } = await params;
  const doc = await db().collection('growthPosts').doc(postId).get();
  if (!doc.exists || doc.data()?.uid !== uid) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = (await req.json()) as {
    caption?: string;
    hashtags?: string[];
    scheduledAt?: string | null;
    status?: string;
  };

  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (body.caption !== undefined) update.caption = body.caption;
  if (body.hashtags !== undefined) update.hashtags = body.hashtags;
  if (body.status !== undefined) update.status = body.status;
  if (body.scheduledAt !== undefined) {
    update.scheduledAt = body.scheduledAt ? Timestamp.fromDate(new Date(body.scheduledAt)) : null;
    if (body.scheduledAt) update.status = 'scheduled';
  }

  await db().collection('growthPosts').doc(postId).update(update);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { postId } = await params;
  const doc = await db().collection('growthPosts').doc(postId).get();
  if (!doc.exists || doc.data()?.uid !== uid) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await db().collection('growthPosts').doc(postId).delete();
  return NextResponse.json({ ok: true });
}
