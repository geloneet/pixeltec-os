'use client';

import { useRouter } from 'next/navigation';
import type { WeekCellData } from '@/lib/assistant/types-history';

const COLOR_MAP: Record<WeekCellData['colorBucket'], string> = {
  high:  'bg-emerald-500/20 border-emerald-500/50 hover:bg-emerald-500/30 hover:border-emerald-400',
  mid:   'bg-amber-500/20  border-amber-500/50  hover:bg-amber-500/30  hover:border-amber-400',
  low:   'bg-rose-500/20   border-rose-500/50   hover:bg-rose-500/30   hover:border-rose-400',
  empty: 'bg-zinc-800/40   border-zinc-700/60   hover:bg-zinc-800/70   hover:border-zinc-600',
};

const RATE_COLOR: Record<WeekCellData['colorBucket'], string> = {
  high:  'text-emerald-400',
  mid:   'text-amber-400',
  low:   'text-rose-400',
  empty: 'text-zinc-500',
};

interface Props {
  cells:        WeekCellData[];
  loadingMore?: boolean;
  sentinelRef?: { current: HTMLDivElement | null };
}

export function WeekTimeline({ cells, loadingMore, sentinelRef }: Props) {
  const router = useRouter();

  if (cells.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
        <p className="text-zinc-500 text-sm">Sin semanas archivadas en este rango.</p>
      </div>
    );
  }

  // Group by month (YYYY-MM) derived from weekStart
  const grouped = new Map<string, WeekCellData[]>();
  for (const c of cells) {
    const monthKey = c.weekStart.slice(0, 7);
    const group = grouped.get(monthKey) ?? [];
    group.push(c);
    grouped.set(monthKey, group);
  }

  return (
    <div className="space-y-8">
      {Array.from(grouped.entries()).map(([month, weeks]) => (
        <section key={month}>
          <h3 className="text-sm font-medium text-zinc-400 mb-3">
            {new Date(`${month}-02`).toLocaleDateString('es-MX', {
              year: 'numeric', month: 'long',
            })}
          </h3>
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
            {weeks.map(w => (
              <button
                key={w.weekKey}
                onClick={() => router.push(`/asistente/historial/${w.weekKey}`)}
                className={`group aspect-square rounded-xl border-2 transition-all duration-150 ${COLOR_MAP[w.colorBucket]} flex flex-col items-center justify-center p-1.5`}
                title={`${w.weekKey} · ${w.totals.completed}/${w.totals.total} tasks · ${(w.completionRate * 100).toFixed(0)}%`}
              >
                <span className="text-[10px] font-mono text-zinc-400">
                  {w.weekKey.slice(-3)}
                </span>
                <span className={`text-base font-semibold tabular-nums leading-tight ${RATE_COLOR[w.colorBucket]}`}>
                  {w.totals.total === 0
                    ? '—'
                    : `${w.totals.completed}/${w.totals.total}`}
                </span>
                {w.totals.total > 0 && (
                  <span className="text-[9px] text-zinc-500 mt-0.5">
                    {(w.completionRate * 100).toFixed(0)}%
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      ))}

      {sentinelRef && <div ref={sentinelRef} className="h-12" />}

      {loadingMore && (
        <div className="flex justify-center py-4">
          <p className="text-sm text-zinc-500">Cargando más semanas…</p>
        </div>
      )}
    </div>
  );
}
