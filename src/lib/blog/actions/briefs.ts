'use server';

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAdminApp } from '@/lib/firebase-admin';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { getAdminAuth } from '@/lib/firebase-admin';
import { BlogBriefSchema, type BlogBriefInput, type ActionResult } from '../schemas';

function db() {
  return getFirestore(getAdminApp());
}

export async function createBrief(input: BlogBriefInput): Promise<ActionResult<{ briefId: string }>> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const parsed = BlogBriefSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos inválidos' };
  }

  const authUser = await getAdminAuth().getUser(uid);

  const ref = db().collection('blogBriefs').doc();
  await ref.set({
    ...parsed.data,
    status: 'pending',
    generatedDraftId: null,
    createdBy: uid,
    createdByName: authUser.displayName ?? 'Admin',
    createdAt: FieldValue.serverTimestamp(),
  });

  return { ok: true, data: { briefId: ref.id } };
}

export async function listBriefs(): Promise<ActionResult<import('../types').BlogBriefSerialized[]>> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const snap = await db()
    .collection('blogBriefs')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  const briefs = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      topic: d.topic,
      angle: d.angle,
      targetAudience: d.targetAudience,
      keyPoints: d.keyPoints ?? [],
      tone: d.tone,
      status: d.status,
      generatedDraftId: d.generatedDraftId ?? null,
      createdBy: d.createdBy,
      createdAt: d.createdAt?.toDate().toISOString() ?? new Date().toISOString(),
    } as import('../types').BlogBriefSerialized;
  });

  return { ok: true, data: briefs };
}

export async function discardBrief(briefId: string): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  await db().collection('blogBriefs').doc(briefId).update({ status: 'discarded' });
  return { ok: true };
}
