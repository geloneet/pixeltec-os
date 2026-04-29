'use server';

import { getSessionUid } from '@/lib/crypto-intel/auth';
import { getReportsRange } from '@/lib/assistant/queries/reports';
import { reportToCell } from '@/lib/assistant/history-stats';
import type { WeekCellData } from '@/lib/assistant/types-history';

export async function loadMoreReports(cursor: string): Promise<
  | { ok: true; cells: WeekCellData[]; nextCursor: string | null }
  | { ok: false; error: string }
> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'unauthorized' };

  const page = await getReportsRange(uid, { cursor, limit: 12 });
  return {
    ok:         true,
    cells:      page.reports.map(reportToCell),
    nextCursor: page.nextCursor,
  };
}
