'use client';

import { ShinyButton } from '@/components/ui/shiny-button';

export function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center text-center gap-6 py-4">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-[0.2em]">PixelTEC</p>
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
          Comencemos con un{' '}
          <span className="bg-gradient-to-r from-blue-400 to-cyan-400 text-transparent bg-clip-text">
            diagnóstico
          </span>{' '}
          de tu empresa.
        </h2>
        <p className="text-zinc-400 text-sm md:text-base leading-relaxed max-w-md mx-auto">
          En menos de 3 minutos analizaremos tu situación actual y prepararemos una sesión mucho más productiva.
        </p>
      </div>
      <ShinyButton type="button" onClick={onNext} className="mt-2 px-8">
        Comenzar
      </ShinyButton>
    </div>
  );
}
