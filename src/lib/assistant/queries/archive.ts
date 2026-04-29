import { db, COL } from '../firebase-admin';
import type { AssistantArchivedTaskDoc, AssistantTaskCategory } from '../types';

export interface ArchivedTaskSerialized {
  id:          string;
  title:       string;
  description: string | null;
  category:    AssistantTaskCategory;
  status:      string;
  startsAt:    string; // ISO
  durationMin: number;
  archivedAt:  string; // ISO
}

export async function getArchivedTasksByWeek(
  uid: string,
  weekKey: string,
): Promise<ArchivedTaskSerialized[]> {
  const snap = await db()
    .collection(COL.assistantTasksArchive)
    .where('uid', '==', uid)
    .where('weekKey', '==', weekKey)
    .orderBy('startsAt', 'asc')
    .get();

  return snap.docs.map(d => {
    const data = d.data() as AssistantArchivedTaskDoc;
    return {
      id:          d.id,
      title:       data.title,
      description: data.description,
      category:    data.category,
      status:      data.status,
      startsAt:    data.startsAt.toDate().toISOString(),
      durationMin: data.durationMin,
      archivedAt:  data.archivedAt.toDate().toISOString(),
    };
  });
}
