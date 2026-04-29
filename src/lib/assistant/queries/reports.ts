import type { Query } from 'firebase-admin/firestore';
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

export async function getReportsRange(
  uid: string,
  opts: { cursor?: string; limit?: number; from?: string; to?: string } = {},
): Promise<{ reports: AssistantWeeklyReportSerialized[]; nextCursor: string | null }> {
  const pageSize = opts.limit ?? 12;

  let q: Query = db()
    .collection(COL.assistantWeeklyReports)
    .where('uid', '==', uid)
    .orderBy('weekKey', 'desc');

  if (opts.from) q = q.where('weekKey', '>=', opts.from);
  if (opts.to)   q = q.where('weekKey', '<=', opts.to);
  if (opts.cursor) q = q.startAfter(opts.cursor);

  const snap = await q.limit(pageSize + 1).get();

  const docs     = snap.docs.slice(0, pageSize);
  const hasMore  = snap.docs.length > pageSize;
  const reports  = docs.map(d => serializeReport(d.data() as AssistantWeeklyReportDoc, d.id));
  const nextCursor = hasMore ? (docs[docs.length - 1].data() as AssistantWeeklyReportDoc).weekKey : null;

  return { reports, nextCursor };
}
