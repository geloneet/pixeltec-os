"use client";

interface Props {
  open: boolean;
  onContinue: () => void;
  onChangeActivity: () => void;
  onPause: () => void;
}

export function FocusGuard({ open, onContinue, onChangeActivity, onPause }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#0F0F12] p-6 shadow-2xl">
        <div className="mb-1 text-2xl">⏸</div>
        <h2 className="mb-1 text-base font-bold text-zinc-100">¿Sigues trabajando?</h2>
        <p className="mb-5 text-sm text-zinc-500">
          Han pasado 20 minutos sin interacción detectada.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onContinue}
            className="w-full rounded-lg bg-cyan-500/10 border border-cyan-500/20 py-2.5 text-sm font-medium text-cyan-300 transition-all hover:bg-cyan-500/20"
          >
            Continuar con esta actividad
          </button>
          <button
            onClick={onChangeActivity}
            className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/40 py-2.5 text-sm font-medium text-zinc-300 transition-all hover:bg-zinc-800/60"
          >
            Cambiar actividad
          </button>
          <button
            onClick={onPause}
            className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/40 py-2.5 text-sm font-medium text-zinc-500 transition-all hover:text-zinc-300"
          >
            Sigo trabajando, cierra esto
          </button>
        </div>
      </div>
    </div>
  );
}
