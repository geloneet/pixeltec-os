'use client';

import { Zap } from 'lucide-react';
import { useCredits } from '@/hooks/growth/use-credits';
import { cn } from '@/lib/utils';

export function CreditBalance({ className }: { className?: string }) {
  const { data } = useCredits();

  const balance = data?.balance ?? 0;
  const pct = data ? (balance / data.monthlyAllowance) * 100 : 100;
  const low = pct < 20;

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Zap className={cn('h-3.5 w-3.5', low ? 'text-amber-400' : 'text-cyan-400')} />
      <span
        className={cn(
          'font-roboto text-xs font-medium tabular-nums',
          low ? 'text-amber-400' : 'text-zinc-400'
        )}
      >
        {balance.toLocaleString()} créditos
      </span>
    </div>
  );
}
