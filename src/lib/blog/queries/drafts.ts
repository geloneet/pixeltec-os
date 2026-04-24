import { getFirestore } from 'firebase-admin/firestore';
import { getAdminApp } from '@/lib/firebase-admin';
import type { BlogBriefSerialized } from '../types';

function db() {
  return getFirestore(getAdminApp());
}

export async function getBriefById(briefId: string): Promise<BlogBriefSerialized | null> {
  const snap = await db().collection('blogBriefs').doc(briefId).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  return {
    id: snap.id,
    topic: d.topic,
    angle: d.angle,
    targetAudience: d.targetAudience,
    keyPoints: d.keyPoints ?? [],
    tone: d.tone,
    status: d.status,
    generatedDraftId: d.generatedDraftId ?? null,
    createdBy: d.createdBy,
    createdAt: d.createdAt?.toDate().toISOString() ?? new Date().toISOString(),
  };
}
