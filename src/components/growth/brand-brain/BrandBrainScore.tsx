'use client';

import { cn } from '@/lib/utils';

interface Props {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export function BrandBrainScore({ score, showLabel = true, size = 'md' }: Props) {
  const color =
    score >= 80
      ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10'
      : score >= 60
        ? 'text-cyan-700 dark:text-cyan-400 bg-cyan-500/10'
        : score >= 30
          ? 'text-amber-700 dark:text-amber-400 bg-amber-500/10'
          : 'text-muted-foreground bg-muted';

  const label =
    score >= 80
      ? 'Completo'
      : score >= 60
        ? 'Usable'
        : score >= 30
          ? 'En progreso'
          : 'Incompleto';

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-lg px-2 py-0.5 font-poppins font-bold tabular-nums',
          size === 'sm' ? 'text-xs' : 'text-sm',
          color
        )}
      >
        {score}%
      </div>
      {showLabel && (
        <span className={cn('font-roboto text-muted-foreground', size === 'sm' ? 'text-xs' : 'text-sm')}>
          {label}
        </span>
      )}
    </div>
  );
}
