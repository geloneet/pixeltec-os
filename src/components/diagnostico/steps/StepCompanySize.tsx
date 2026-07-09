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
      <h2 className="text-xl md:text-2xl font-bold text-white mb-1">Tamaño de empresa</h2>
      <p className="text-zinc-500 text-sm mb-6">¿Cuántas personas trabajan contigo?</p>
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
                  ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300'
                  : 'border-white/5 bg-[#0A0A0A] text-zinc-200 hover:border-white/15'
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
