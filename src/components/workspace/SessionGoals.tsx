"use client";

import { useState } from "react";
import type { SessionGoal } from "@/types/session";

interface Props {
  goals: SessionGoal[];
  onAdd: (text: string) => void;
  onToggle: (goalId: string) => void;
  onRemove: (goalId: string) => void;
}

const MAX_ACTIVE = 3;

export function SessionGoals({ goals, onAdd, onToggle, onRemove }: Props) {
  const [text, setText] = useState("");
  const activeCount = goals.filter(g => !g.completed).length;
  const atLimit = activeCount >= MAX_ACTIVE;

  const handleSubmit = () => {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText("");
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-zinc-400">Objetivos de esta sesión</p>
        {goals.length > 0 && (
          <span className="text-[0.65rem] text-zinc-600">
            {goals.filter(g => g.completed).length}/{goals.length} completados
          </span>
        )}
      </div>

      {goals.length === 0 ? (
        <p className="text-xs text-zinc-600 mb-3 leading-relaxed">
          Sin objetivos definidos. Agrega hasta {MAX_ACTIVE} objetivos para mantener el enfoque durante esta sesión.
        </p>
      ) : (
        <ul className="space-y-1.5 mb-3">
          {goals.map(goal => (
            <li key={goal.id} className="group flex items-start gap-2">
              <button
                onClick={() => onToggle(goal.id)}
                className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 rounded border transition-all ${
                  goal.completed
                    ? "border-green-500 bg-green-500/20"
                    : "border-zinc-600 hover:border-zinc-400"
                }`}
                aria-label={goal.completed ? "Marcar como pendiente" : "Marcar como completado"}
              >
                {goal.completed && (
                  <span className="flex h-full items-center justify-center text-[9px] text-green-400">✓</span>
                )}
              </button>
              <span className={`text-xs flex-1 leading-relaxed ${goal.completed ? "line-through text-zinc-600" : "text-zinc-300"}`}>
                {goal.text}
              </span>
              <button
                onClick={() => onRemove(goal.id)}
                className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-zinc-400 text-[10px] transition-opacity flex-shrink-0 mt-0.5"
                aria-label="Eliminar objetivo"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSubmit(); } }}
          placeholder="Nuevo objetivo..."
          disabled={atLimit}
          className="flex-1 rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/30 focus:outline-none transition-colors disabled:opacity-40"
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || atLimit}
          className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + Agregar
        </button>
      </div>
      {atLimit && (
        <p className="mt-1.5 text-[0.65rem] text-amber-500/70">
          Máximo recomendado de {MAX_ACTIVE} objetivos activos alcanzado.
        </p>
      )}
    </div>
  );
}
