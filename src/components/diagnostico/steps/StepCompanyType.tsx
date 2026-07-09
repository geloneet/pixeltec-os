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
      <h2 className="text-xl md:text-2xl font-bold text-white mb-1">¿Qué tipo de empresa tienes?</h2>
      <p className="text-zinc-500 text-sm mb-6">Elige la opción que más se parezca a tu negocio.</p>
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
                  ? 'border-cyan-500/60 bg-cyan-500/10'
                  : 'border-white/5 bg-[#0A0A0A] hover:border-cyan-500/30 hover:-translate-y-0.5'
              )}
            >
              <Icon className={cn('h-6 w-6', selected ? 'text-cyan-300' : 'text-zinc-400 group-hover:text-cyan-400')} />
              <span className={cn('text-sm font-semibold', selected ? 'text-cyan-300' : 'text-zinc-200')}>
                {type.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
