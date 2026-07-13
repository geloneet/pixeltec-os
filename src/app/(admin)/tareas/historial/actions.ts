'use server';

import { getSessionUid } from '@/lib/auth/session';
import { getReportsRange } from '@/lib/assistant/queries/reports';
import { reportToCell } from '@/lib/assistant/history-stats';
import type { WeekCellData } from '@/lib/assistant/types-history';

export interface LoadMoreArgs {
  cursor?:      string | null;
  from?:        string;
  to?:          string;
  colorBucket?: WeekCellData['colorBucket'][];
}

export async function loadMoreReports(args: LoadMoreArgs = {}): Promise<
  | { ok: true; cells: WeekCellData[]; nextCursor: string | null }
  | { ok: false; error: string }
> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'unauthorized' };

  const page = await getReportsRange(uid, {
    cursor:      args.cursor ?? undefined,
    limit:       12,
    from:        args.from,
    to:          args.to,
    colorBucket: args.colorBucket,
  });

  return {
    ok:         true,
    cells:      page.reports.map(reportToCell),
    nextCursor: page.nextCursor,
  };
}
