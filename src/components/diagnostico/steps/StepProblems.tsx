'use client';

import { PROBLEMS } from '@/lib/diagnostic/logic';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { ShinyButton } from '@/components/ui/shiny-button';
import type { StepProps } from '../types';

export function StepProblems({ answers, update, onNext }: StepProps) {
  function toggle(value: string) {
    const has = answers.problems.includes(value);
    update({ problems: has ? answers.problems.filter((p) => p !== value) : [...answers.problems, value] });
  }

  return (
    <div>
      <h2 className="text-xl md:text-2xl font-bold text-white mb-1">¿Cuál es tu principal problema?</h2>
      <p className="text-zinc-500 text-sm mb-6">Selecciona todos los que apliquen.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {PROBLEMS.map((problem) => {
          const selected = answers.problems.includes(problem.value);
          return (
            <button
              key={problem.value}
              type="button"
              onClick={() => toggle(problem.value)}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition-colors duration-200',
                selected
                  ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300'
                  : 'border-white/5 bg-[#0A0A0A] text-zinc-300 hover:border-white/15'
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                  selected ? 'border-cyan-400 bg-cyan-500/80' : 'border-zinc-600'
                )}
              >
                {selected && <Check className="h-3.5 w-3.5 text-white" />}
              </span>
              {problem.label}
            </button>
          );
        })}
      </div>
      <ShinyButton
        type="button"
        onClick={onNext}
        disabled={answers.problems.length === 0}
        className="mt-8 w-full sm:w-auto px-8"
      >
        Siguiente
      </ShinyButton>
    </div>
  );
}
