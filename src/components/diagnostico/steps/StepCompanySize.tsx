'use client';

import { COMPANY_SIZES } from '@/lib/diagnostic/logic';
import { cn } from '@/lib/utils';
import type { StepProps } from '../types';

export function StepCompanySize({ answers, update, onNext }: StepProps) {
  function select(value: string) {
    update({ companySize: value });
    onNext();
  }

  return (
    <div>
      <h2 className="text-xl md:text-2xl font-bold text-foreground dark:text-white mb-1">Tamaño de empresa</h2>
      <p className="text-muted-foreground dark:text-zinc-500 text-sm mb-6">¿Cuántas personas trabajan contigo?</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {COMPANY_SIZES.map((size) => {
          const selected = answers.companySize === size.value;
          return (
            <button
              key={size.value}
              type="button"
              onClick={() => select(size.value)}
              className={cn(
                'rounded-xl border px-5 py-4 text-center text-sm font-semibold transition-colors duration-200',
                selected
                  ? 'border-primary/60 bg-primary/10 text-brand dark:border-cyan-500/60 dark:bg-cyan-500/10 dark:text-cyan-300'
                  : 'border-border bg-card text-foreground/85 hover:border-primary/40 dark:border-white/5 dark:bg-[#0A0A0A] dark:text-zinc-200 dark:hover:border-white/15'
              )}
            >
              {size.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
