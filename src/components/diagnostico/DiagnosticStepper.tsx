'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Los 5 pasos de captura (Bienvenida y Resultado son pantallas de bookend,
// sin número en el stepper). Patrón tomado de WizardProgress.tsx
// (brand-brain), adaptado al tono/paleta de /industrias.
const STEPS = ['Empresa', 'Problema', 'Tamaño', 'Prioridad', 'Contacto'];

export function DiagnosticStepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((label, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        return (
          <div key={label} className="flex items-center">
            <div
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-bold transition-colors',
                done
                  ? 'border-cyan-500 bg-cyan-500 text-white'
                  : active
                    ? 'border-cyan-500 bg-transparent text-cyan-400'
                    : 'border-zinc-700 text-zinc-600'
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('h-px w-6 sm:w-10 transition-colors', done ? 'bg-cyan-500' : 'bg-zinc-800')} />
            )}
          </div>
        );
      })}
    </div>
  );
}
