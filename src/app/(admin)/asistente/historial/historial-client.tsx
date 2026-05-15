'use client';

import { useState, useRef, useEffect } from 'react';
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

/**
 * Mapea `status` de UI al subconjunto de buckets aceptados por Firestore (`in`).
 *  - 'all'        → undefined (sin filtro server-side)
 *  - 'completed'  → ['high']
 *  - 'incomplete' → ['mid','low','empty']  (réplica de `c.colorBucket !== 'high'`)
 */
function mapStatusToBuckets(
  status: HistoryFiltersState['status'],
): WeekCellData['colorBucket'][] | undefined {
  if (status === 'completed')  return ['high'];
  if (status === 'incomplete') return ['mid', 'low', 'empty'];
  return undefined;
}

function filtersAreEmpty(f: HistoryFiltersState): boolean {
  return !f.from && !f.to && (!f.status || f.status === 'all');
}

export function HistorialClient({ initialCells, initialCursor, initialStats }: Props) {
  const [cells,       setCells]       = useState<WeekCellData[]>(initialCells);
  const [cursor,      setCursor]      = useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [resetting,   setResetting]   = useState(false);
  const [filters,     setFilters]     = useState<HistoryFiltersState>({ status: 'all' });

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef  = useRef(false);

  // Reset + refetch cuando cambian los filtros.
  useEffect(() => {
    // Filtros vacíos → restaurar lo que el server entregó al montar.
    if (filtersAreEmpty(filters)) {
      setCells(initialCells);
      setCursor(initialCursor);
      setResetting(false);
      return;
    }

    let cancelled = false;
    setResetting(true);
    setCells([]);
    setCursor(null);
    loadingRef.current = false;

    (async () => {
      const result = await loadMoreReports({
        cursor:      null,
        from:        filters.from,
        to:          filters.to,
        colorBucket: mapStatusToBuckets(filters.status),
      });
      if (cancelled) return;
      if (result.ok) {
        setCells(result.cells);
        setCursor(result.nextCursor);
      }
      setResetting(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [filters, initialCells, initialCursor]);

  // Infinite scroll via IntersectionObserver. Pasa filtros activos en cada fetch.
  useEffect(() => {
    if (!cursor) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      async (entries) => {
        if (!entries[0].isIntersecting || loadingRef.current) return;
        loadingRef.current = true;
        setLoadingMore(true);

        const result = await loadMoreReports({
          cursor,
          from:        filters.from,
          to:          filters.to,
          colorBucket: mapStatusToBuckets(filters.status),
        });
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
  }, [cursor, filters]);

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
        cells={cells}
        loadingMore={loadingMore || resetting}
        sentinelRef={sentinelRef}
      />
    </div>
  );
}
