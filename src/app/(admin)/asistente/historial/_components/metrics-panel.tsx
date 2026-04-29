'use client';

import type { HistoryStatsSummary } from '@/lib/assistant/types-history';

interface Props {
  stats: HistoryStatsSummary;
}

interface CardDef {
  label:        string;
  value:        string | number;
  delta?:       number | null;
  isPercentDelta?: boolean;
  hint?:        string;
  tone:         'neutral' | 'positive' | 'warn' | 'danger';
}

export function MetricsPanel({ stats }: Props) {
  const tone = stats.completionRate >= 0.75
    ? 'positive'
    : stats.completionRate >= 0.5
    ? 'warn'
    : 'danger';

  const cards: CardDef[] = [
    {
      label: 'Archivadas (4 sem)',
      value: stats.archivedTotal,
      delta: stats.trend.deltaArchived,
      tone:  'neutral',
    },
    {
      label: 'Completadas (4 sem)',
      value: stats.completedTotal,
      delta: null,
      tone:  'positive',
    },
    {
      label:         'Tasa completion',
      value:         `${(stats.completionRate * 100).toFixed(0)}%`,
      delta:         stats.trend.deltaCompletion,
      isPercentDelta: true,
      tone,
    },
    {
      label: 'Drift',
      value: stats.drift,
      delta: null,
      tone:  'neutral',
      hint:  'Pospuestas + canceladas + pendientes',
    },
  ];

  const accentFor = (tone: CardDef['tone']) => {
    if (tone === 'positive') return 'text-emerald-400';
    if (tone === 'warn')     return 'text-amber-400';
    if (tone === 'danger')   return 'text-rose-400';
    return 'text-zinc-100';
  };

  const deltaColor = (delta: number) => {
    if (delta > 0) return 'text-emerald-400';
    if (delta < 0) return 'text-rose-400';
    return 'text-zinc-500';
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(c => (
        <div
          key={c.label}
          className="rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur p-6 hover:border-zinc-700 transition-colors"
        >
          <p className="text-xs uppercase tracking-wider text-zinc-500">{c.label}</p>
          <p className={`mt-2 text-3xl font-semibold tabular-nums ${accentFor(c.tone)}`}>
            {c.value}
          </p>
          {c.delta != null && (
            <p className={`mt-1.5 text-sm tabular-nums ${deltaColor(c.delta)}`}>
              {c.delta > 0 ? '↑' : c.delta < 0 ? '↓' : '·'}{' '}
              {c.isPercentDelta
                ? `${(Math.abs(c.delta) * 100).toFixed(1)}%`
                : Math.abs(c.delta)}
              {' '}vs período anterior
            </p>
          )}
          {c.hint && (
            <p className="mt-1 text-xs text-zinc-600">{c.hint}</p>
          )}
        </div>
      ))}
    </div>
  );
}
