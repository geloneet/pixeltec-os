"use client";

interface Props {
  activityText: string;
  onChange: (value: string) => void;
  onUpdate: () => void;
  onDone: () => void;
}

export function CurrentActivity({ activityText, onChange, onUpdate, onDone }: Props) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
      <p className="mb-2 text-xs font-semibold text-zinc-400">Actividad actual</p>
      <input
        type="text"
        value={activityText}
        onChange={e => onChange(e.target.value)}
        onBlur={onUpdate}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onUpdate(); } }}
        placeholder="Describe lo que estás haciendo ahora..."
        className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/30 focus:outline-none transition-colors"
      />
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onUpdate}
          className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-all hover:text-zinc-200"
        >
          Actualizar actividad
        </button>
        <button
          onClick={onDone}
          className="rounded-lg border border-green-500/20 bg-green-500/[0.06] px-3 py-1.5 text-xs font-medium text-green-400 transition-all hover:bg-green-500/10"
        >
          ✓ Actividad terminada
        </button>
      </div>
    </div>
  );
}
