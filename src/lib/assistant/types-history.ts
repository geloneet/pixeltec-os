import type { ReportTotals } from './types';

export interface HistoryStatsSummary {
  archivedTotal:   number;
  completedTotal:  number;
  completionRate:  number; // 0..1
  drift:           number; // cancelled + postponed + pending
  trend: {
    deltaArchived:    number;
    deltaCompletion:  number;
  };
}

export interface WeekCellData {
  weekKey:        string;
  weekStart:      string; // ISO
  weekEnd:        string;
  totals:         ReportTotals;
  completionRate: number; // 0..1
  colorBucket:    'high' | 'mid' | 'low' | 'empty';
}

export interface HistoryFiltersState {
  from?:   string; // YYYY-MM-DD
  to?:     string;
  status?: 'all' | 'completed' | 'incomplete';
}

export interface HistoryPage {
  cells:      WeekCellData[];
  nextCursor: string | null;
}
