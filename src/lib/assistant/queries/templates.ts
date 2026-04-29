import { db, COL } from '../firebase-admin';
import {
  serializeTemplate,
  type AssistantTemplateDoc,
  type AssistantTemplateSerialized,
} from '../types';

export async function getTemplates(
  uid: string,
  opts?: { activeOnly?: boolean },
): Promise<AssistantTemplateSerialized[]> {
  const base = db()
    .collection(COL.assistantTemplates)
    .where('uid', '==', uid);

  const q = opts?.activeOnly
    ? base.where('active', '==', true).orderBy('createdAt', 'desc')
    : base.orderBy('createdAt', 'desc');

  const snap = await q.get();
  return snap.docs.map((doc) =>
    serializeTemplate(doc.data() as AssistantTemplateDoc, doc.id),
  );
}

export async function getTemplateById(
  uid: string,
  id: string,
): Promise<AssistantTemplateSerialized | null> {
  const doc = await db().collection(COL.assistantTemplates).doc(id).get();
  if (!doc.exists) return null;
  const data = doc.data() as AssistantTemplateDoc;
  if (data.uid !== uid) return null;
  return serializeTemplate(data, doc.id);
}
