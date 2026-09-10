'use client';

import { COMPANY_TYPES } from '@/lib/diagnostic/logic';
import { cn } from '@/lib/utils';
import type { StepProps } from '../types';

export function StepCompanyType({ answers, update, onNext }: StepProps) {
  function select(value: string) {
    update({ companyType: value });
    onNext();
  }

  return (
    <div>
      <h2 className="text-xl md:text-2xl font-bold text-foreground dark:text-white mb-1">¿Qué tipo de empresa tienes?</h2>
      <p className="text-muted-foreground dark:text-zinc-500 text-sm mb-6">Elige la opción que más se parezca a tu negocio.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {COMPANY_TYPES.map((type) => {
          const Icon = type.icon;
          const selected = answers.companyType === type.value;
          return (
            <button
              key={type.value}
              type="button"
              onClick={() => select(type.value)}
              className={cn(
                'group flex flex-col items-center justify-center gap-2.5 rounded-2xl border p-5 text-center transition-all duration-200',
                selected
                  ? 'border-primary/60 bg-primary/10 dark:border-cyan-500/60 dark:bg-cyan-500/10'
                  : 'border-border bg-card hover:border-primary/40 hover:shadow-[0_8px_24px_-12px_rgba(33,150,243,0.35)] hover:-translate-y-0.5 dark:border-white/5 dark:bg-[#0A0A0A] dark:hover:border-cyan-500/30 dark:hover:shadow-none'
              )}
            >
              <Icon
                className={cn(
                  'h-6 w-6',
                  selected
                    ? 'text-brand dark:text-cyan-300'
                    : 'text-muted-foreground group-hover:text-brand dark:text-zinc-400 dark:group-hover:text-cyan-400'
                )}
              />
              <span
                className={cn(
                  'text-sm font-semibold',
                  selected ? 'text-brand dark:text-cyan-300' : 'text-foreground/85 dark:text-zinc-200'
                )}
              >
                {type.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
