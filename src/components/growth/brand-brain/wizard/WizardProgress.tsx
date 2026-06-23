'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { label: 'Negocio' },
  { label: 'Servicios' },
  { label: 'Cliente' },
  { label: 'Voz' },
  { label: 'Visual' },
];

interface Props {
  currentStep: number;
}

export function WizardProgress({ currentStep }: Props) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-colors',
                  done
                    ? 'border-cyan-500 bg-cyan-500 text-white'
                    : active
                      ? 'border-cyan-500 bg-zinc-900 text-cyan-400'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-600'
                )}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  'mt-1 hidden text-[10px] sm:block',
                  active ? 'text-cyan-400' : done ? 'text-zinc-400' : 'text-zinc-600'
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'mb-4 h-px w-8 transition-colors sm:w-14',
                  i < currentStep ? 'bg-cyan-500' : 'bg-zinc-800'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
