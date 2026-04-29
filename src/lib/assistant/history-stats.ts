import type { AssistantWeeklyReportSerialized } from './types';
import type { HistoryStatsSummary, WeekCellData } from './types-history';

export function colorBucketFor(rate: number, total: number): WeekCellData['colorBucket'] {
  if (total === 0) return 'empty';
  if (rate >= 0.75) return 'high';
  if (rate >= 0.5)  return 'mid';
  return 'low';
}

export function reportToCell(r: AssistantWeeklyReportSerialized): WeekCellData {
  const total = r.totals.total;
  const rate  = total > 0 ? r.totals.completed / total : 0;
  return {
    weekKey:        r.weekKey,
    weekStart:      r.weekStart,
    weekEnd:        r.weekEnd,
    totals:         r.totals,
    completionRate: rate,
    colorBucket:    colorBucketFor(rate, total),
  };
}

export function computeStats(
  recent:   AssistantWeeklyReportSerialized[],
  previous: AssistantWeeklyReportSerialized[],
): HistoryStatsSummary {
  function sum(arr: AssistantWeeklyReportSerialized[], pick: (t: AssistantWeeklyReportSerialized['totals']) => number) {
    return arr.reduce((a, r) => a + pick(r.totals), 0);
  }

  const archivedTotal  = sum(recent, t => t.total);
  const completedTotal = sum(recent, t => t.completed);
  const drift          = sum(recent, t => t.cancelled + t.postponed + t.pending);
  const completionRate = archivedTotal > 0 ? completedTotal / archivedTotal : 0;

  const prevArchived  = sum(previous, t => t.total);
  const prevCompleted = sum(previous, t => t.completed);
  const prevRate      = prevArchived > 0 ? prevCompleted / prevArchived : 0;

  return {
    archivedTotal,
    completedTotal,
    completionRate,
    drift,
    trend: {
      deltaArchived:   archivedTotal - prevArchived,
      deltaCompletion: completionRate - prevRate,
    },
  };
}
