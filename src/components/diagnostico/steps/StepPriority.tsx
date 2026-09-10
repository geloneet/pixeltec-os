'use client';

import { PRIORITIES } from '@/lib/diagnostic/logic';
import { cn } from '@/lib/utils';
import type { StepProps } from '../types';

export function StepPriority({ answers, update, onNext }: StepProps) {
  function select(value: string) {
    update({ priority: value });
    onNext();
  }

  return (
    <div>
      <h2 className="text-xl md:text-2xl font-bold text-foreground dark:text-white mb-1">¿Qué quieres lograr primero?</h2>
      <p className="text-muted-foreground dark:text-zinc-500 text-sm mb-6">Tu prioridad guía la recomendación final.</p>
      <div className="space-y-2.5">
        {PRIORITIES.map((priority) => {
          const selected = answers.priority === priority.value;
          return (
            <button
              key={priority.value}
              type="button"
              onClick={() => select(priority.value)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border px-5 py-3.5 text-left text-sm font-medium transition-colors duration-200',
                selected
                  ? 'border-primary/60 bg-primary/10 text-brand dark:border-cyan-500/60 dark:bg-cyan-500/10 dark:text-cyan-300'
                  : 'border-border bg-card text-foreground/85 hover:border-primary/40 dark:border-white/5 dark:bg-[#0A0A0A] dark:text-zinc-200 dark:hover:border-white/15'
              )}
            >
              <span
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                  selected ? 'border-primary dark:border-cyan-400' : 'border-border dark:border-zinc-600'
                )}
              >
                {selected && <span className="h-2 w-2 rounded-full bg-primary dark:bg-cyan-400" />}
              </span>
              {priority.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
