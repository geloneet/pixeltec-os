'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import type { WeekCellData, HistoryStatsSummary, HistoryFiltersState } from '@/lib/assistant/types-history';
import { MetricsPanel } from './_components/metrics-panel';
import { WeekTimeline } from './_components/week-timeline';
import { HistoryFilters } from './_components/history-filters';
import { loadMoreReports } from './actions';

interface Props {
  initialCells:  WeekCellData[];
  initialCursor: string | null;
  initialStats:  HistoryStatsSummary;
}

export function HistorialClient({ initialCells, initialCursor, initialStats }: Props) {
  const [cells,       setCells]       = useState<WeekCellData[]>(initialCells);
  const [cursor,      setCursor]      = useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filters,     setFilters]     = useState<HistoryFiltersState>({ status: 'all' });

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef  = useRef(false);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!cursor) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      async (entries) => {
        if (!entries[0].isIntersecting || loadingRef.current) return;
        loadingRef.current = true;
        setLoadingMore(true);

        const result = await loadMoreReports(cursor);
        if (result.ok) {
          setCells(prev => [...prev, ...result.cells]);
          setCursor(result.nextCursor);
        }

        loadingRef.current = false;
        setLoadingMore(false);
      },
      { rootMargin: '300px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [cursor]);

  // Client-side filtering
  const filteredCells = useMemo(() => {
    return cells.filter(c => {
      const weekDate = c.weekStart.slice(0, 10);
      if (filters.from && weekDate < filters.from) return false;
      if (filters.to   && weekDate > filters.to)   return false;

      if (filters.status === 'completed'  && c.colorBucket !== 'high') return false;
      if (filters.status === 'incomplete' && c.colorBucket === 'high') return false;

      return true;
    });
  }, [cells, filters]);

  return (
    <div className="flex flex-col gap-6 p-6 min-h-screen bg-gradient-to-b from-zinc-950 to-zinc-900/80">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Historial</h1>
          <p className="text-sm text-zinc-400">
            {cells.length} semana{cells.length !== 1 ? 's' : ''} archivada{cells.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/asistente"
          className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          ← Asistente
        </Link>
      </div>

      {/* KPI cards */}
      <MetricsPanel stats={initialStats} />

      {/* Filters */}
      <HistoryFilters value={filters} onChange={setFilters} />

      {/* Timeline */}
      <WeekTimeline
        cells={filteredCells}
        loadingMore={loadingMore}
        sentinelRef={sentinelRef}
      />
    </div>
  );
}
