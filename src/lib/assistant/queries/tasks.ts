import { db, COL } from '../firebase-admin';
import { serializeTask, type AssistantTaskDoc, type AssistantTaskSerialized } from '../types';
import { getCurrentWeekKey } from '../week-helpers';

export async function getCurrentWeekTasks(uid: string): Promise<AssistantTaskSerialized[]> {
  const weekKey = getCurrentWeekKey();
  const snap = await db()
    .collection(COL.assistantTasks)
    .where('uid', '==', uid)
    .where('weekKey', '==', weekKey)
    .orderBy('startsAt', 'asc')
    .get();

  return snap.docs.map((doc) =>
    serializeTask(doc.data() as AssistantTaskDoc, doc.id),
  );
}

export async function getTaskById(
  uid: string,
  taskId: string,
): Promise<AssistantTaskSerialized | null> {
  const doc = await db().collection(COL.assistantTasks).doc(taskId).get();
  if (!doc.exists) return null;
  const data = doc.data() as AssistantTaskDoc;
  if (data.uid !== uid) return null;
  return serializeTask(data, doc.id);
}
