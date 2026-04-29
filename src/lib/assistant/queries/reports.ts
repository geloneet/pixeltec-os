import { db, COL } from '../firebase-admin';
import {
  serializeReport,
  type AssistantWeeklyReportDoc,
  type AssistantWeeklyReportSerialized,
} from '../types';

export async function getReportByWeekKey(
  uid: string,
  weekKey: string,
): Promise<AssistantWeeklyReportSerialized | null> {
  const reportId = `${uid}_${weekKey}`;
  const doc = await db().collection(COL.assistantWeeklyReports).doc(reportId).get();
  if (!doc.exists) return null;
  return serializeReport(doc.data() as AssistantWeeklyReportDoc, doc.id);
}

export async function getRecentReports(
  uid: string,
  limit = 4,
): Promise<AssistantWeeklyReportSerialized[]> {
  const snap = await db()
    .collection(COL.assistantWeeklyReports)
    .where('uid', '==', uid)
    .orderBy('weekKey', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((doc) =>
    serializeReport(doc.data() as AssistantWeeklyReportDoc, doc.id),
  );
}
