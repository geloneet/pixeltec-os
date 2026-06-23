"use client";

import { useState } from "react";
import { BLOCKER_LABELS } from "@/types/session";
import type { BlockerType, SessionBlocker } from "@/types/session";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  blockers: SessionBlocker[];
  onAddBlocker: (type: BlockerType, description: string) => void;
}

const BLOCKER_TYPES: BlockerType[] = [
  "error_api",
  "acceso_faltante",
  "pendiente_cliente",
  "dependencia_externa",
];

export function BlockReporter({ blockers, onAddBlocker }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<BlockerType>("error_api");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    if (!description.trim()) return;
    onAddBlocker(selectedType, description.trim());
    setDescription("");
    setOpen(false);
  };

  const openBlockers = blockers.filter(b => !b.resolved);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-zinc-400">
          Bloqueos
          {openBlockers.length > 0 && (
            <span className="ml-2 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
              {openBlockers.length}
            </span>
          )}
        </p>
        <button
          onClick={() => setOpen(!open)}
          className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-2.5 py-1 text-[11px] font-medium text-red-400 transition-all hover:bg-red-500/10"
        >
          + Reportar bloqueo
        </button>
      </div>

      {open && (
        <div className="mb-3 rounded-lg border border-white/[0.06] bg-zinc-900/40 p-3 space-y-2">
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value as BlockerType)}
            className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300 focus:outline-none"
          >
            {BLOCKER_TYPES.map(t => (
              <option key={t} value={t}>{BLOCKER_LABELS[t]}</option>
            ))}
          </select>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSubmit(); } }}
            placeholder="Describe el bloqueo..."
            className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300 placeholder:text-zinc-600 focus:border-red-500/30 focus:outline-none transition-colors"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              className="flex-1 rounded-lg bg-red-500/10 border border-red-500/20 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-all"
            >
              Reportar
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {openBlockers.length > 0 && (
        <div className="space-y-1.5">
          {openBlockers.map(blocker => (
            <div key={blocker.id} className="rounded-lg border border-red-500/10 bg-red-500/[0.04] px-3 py-2">
              <p className="text-[10px] font-medium text-red-400">{BLOCKER_LABELS[blocker.type]}</p>
              <p className="text-xs text-zinc-400">{blocker.description}</p>
              <p className="text-[10px] text-zinc-600">
                {format(new Date(blocker.createdAt), "HH:mm", { locale: es })}
              </p>
            </div>
          ))}
        </div>
      )}

      {openBlockers.length === 0 && (
        <p className="text-center py-2 text-xs text-zinc-600">No hay bloqueos activos</p>
      )}
    </div>
  );
}
