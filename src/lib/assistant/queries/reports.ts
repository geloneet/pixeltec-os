// Postgres (Drizzle) — antes Firestore `assistantWeeklyReports`.
import { and, desc, eq, gte, inArray, lt, lte, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { assistantWeeklyReports } from '@/lib/db/schema';
import { reportRowToSerialized, resolveOwnerId } from '../pg';
import type { AssistantWeeklyReportSerialized } from '../types';
import type { WeekCellData } from '../types-history';

export async function getReportByWeekKey(
  uid: string,
  weekKey: string,
): Promise<AssistantWeeklyReportSerialized | null> {
  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return null;

  const [row] = await db
    .select()
    .from(assistantWeeklyReports)
    .where(
      and(eq(assistantWeeklyReports.ownerId, ownerId), eq(assistantWeeklyReports.weekKey, weekKey)),
    )
    .limit(1);
  if (!row) return null;
  return reportRowToSerialized(row, uid);
}

export async function getRecentReports(
  uid: string,
  limit = 4,
): Promise<AssistantWeeklyReportSerialized[]> {
  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return [];

  const rows = await db
    .select()
    .from(assistantWeeklyReports)
    .where(eq(assistantWeeklyReports.ownerId, ownerId))
    .orderBy(desc(assistantWeeklyReports.weekKey))
    .limit(limit);
  return rows.map((row) => reportRowToSerialized(row, uid));
}

export async function getReportsRange(
  uid: string,
  opts: {
    cursor?:      string;
    limit?:       number;
    from?:        string;
    to?:          string;
    /**
     * Lista de buckets aceptados (OR vía `in`). `undefined` o `[]` = sin filtro.
     * Para "completed" pasar `['high']`; para "incomplete" pasar `['mid','low','empty']`.
     */
    colorBucket?: WeekCellData['colorBucket'][];
  } = {},
): Promise<{ reports: AssistantWeeklyReportSerialized[]; nextCursor: string | null }> {
  const ownerId = await resolveOwnerId(uid);
  if (!ownerId) return { reports: [], nextCursor: null };

  const pageSize = opts.limit ?? 12;

  const conditions: SQL[] = [eq(assistantWeeklyReports.ownerId, ownerId)];
  if (opts.from) conditions.push(gte(assistantWeeklyReports.weekKey, opts.from));
  if (opts.to)   conditions.push(lte(assistantWeeklyReports.weekKey, opts.to));
  if (opts.colorBucket && opts.colorBucket.length > 0) {
    conditions.push(inArray(assistantWeeklyReports.colorBucket, opts.colorBucket));
  }
  // Cursor = weekKey de la última fila de la página anterior (orden desc).
  if (opts.cursor) conditions.push(lt(assistantWeeklyReports.weekKey, opts.cursor));

  const rows = await db
    .select()
    .from(assistantWeeklyReports)
    .where(and(...conditions))
    .orderBy(desc(assistantWeeklyReports.weekKey))
    .limit(pageSize + 1);

  const page    = rows.slice(0, pageSize);
  const hasMore = rows.length > pageSize;
  const reports = page.map((row) => reportRowToSerialized(row, uid));
  const nextCursor = hasMore ? page[page.length - 1].weekKey : null;

  return { reports, nextCursor };
}
