"use client";

import { useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronUp, ChevronDown, Check, Play, Pen, X } from "lucide-react";
import type { SessionGoal } from "@/types/session";

interface Props {
  goals: SessionGoal[];
  onAdd: (text: string) => void;
  onToggle: (goalId: string) => void;
  onRemove: (goalId: string) => void;
  onUpdate: (goalId: string, text: string) => void;
  onReorder: (goalId: string, direction: "up" | "down") => void;
}

const MAX_ACTIVE = 3;

export function SessionGoals({ goals, onAdd, onToggle, onRemove, onUpdate, onReorder }: Props) {
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [poppingId, setPoppingId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const atLimit = goals.length >= MAX_ACTIVE;

  const completed = goals.filter(g => g.completed);
  const pct = goals.length > 0 ? Math.round((completed.length / goals.length) * 100) : 0;
  // First uncompleted goal = active
  const activeGoalId = goals.find(g => !g.completed)?.id ?? null;

  const handleSubmit = () => {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText("");
  };

  const handleToggle = (goalId: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (goal && !goal.completed) {
      // Completing — trigger pop
      setPoppingId(goalId);
      setTimeout(() => setPoppingId(null), 300);
    }
    onToggle(goalId);
  };

  const startEdit = (goal: SessionGoal) => {
    setEditingId(goal.id);
    setEditText(goal.text);
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  const commitEdit = (goalId: string) => {
    if (editText.trim()) onUpdate(goalId, editText.trim());
    setEditingId(null);
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-zinc-400">Objetivos de esta sesión</p>
        {goals.length > 0 && (
          <div className="flex items-center gap-2">
            {/* Progress bar */}
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1 rounded-full bg-zinc-800 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-green-500/70"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
              </div>
              <span className="text-[0.65rem] text-zinc-500 tabular-nums">{pct}%</span>
            </div>
          </div>
        )}
      </div>

      {goals.length === 0 ? (
        <div className="flex flex-col items-center text-center py-4 mb-2 gap-2">
          <div className="h-8 w-8 rounded-xl bg-zinc-800/60 flex items-center justify-center">
            <span className="text-base">🎯</span>
          </div>
          <div>
            <p className="text-xs text-zinc-400 font-medium">Sin objetivos definidos</p>
            <p className="text-[0.65rem] text-zinc-600 mt-0.5 max-w-[180px] leading-relaxed">
              Agrega hasta {MAX_ACTIVE} para mantener el foco de esta sesión.
            </p>
          </div>
        </div>
      ) : (
        <ul className="space-y-1.5 mb-3">
          <AnimatePresence initial={false}>
            {goals.map((goal, i) => {
              const isActive = goal.id === activeGoalId;
              const isPopping = goal.id === poppingId;
              const isEditing = goal.id === editingId;

              return (
                <motion.li
                  key={goal.id}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className={`group flex items-start gap-2 rounded-lg px-2 py-1.5 -mx-2 transition-colors ${
                    isActive
                      ? "border border-cyan-500/20 bg-cyan-500/[0.04]"
                      : "border border-transparent"
                  }`}
                >
                  {/* Checkbox */}
                  <motion.button
                    onClick={() => handleToggle(goal.id)}
                    animate={isPopping ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 rounded border transition-all ${
                      goal.completed
                        ? "border-green-500 bg-green-500/20"
                        : isActive
                          ? "border-cyan-500/50 hover:border-cyan-400"
                          : "border-zinc-600 hover:border-zinc-400"
                    }`}
                    aria-label={goal.completed ? "Marcar como pendiente" : "Marcar como completado"}
                  >
                    {goal.completed && (
                      <Check className="h-2.5 w-2.5 text-green-400 m-auto" />
                    )}
                  </motion.button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        onBlur={() => commitEdit(goal.id)}
                        onKeyDown={e => {
                          if (e.key === "Enter") { e.preventDefault(); commitEdit(goal.id); }
                          if (e.key === "Escape") { setEditingId(null); }
                        }}
                        className="w-full bg-transparent text-xs text-zinc-200 focus:outline-none border-b border-cyan-500/30"
                      />
                    ) : (
                      <span
                        className={`text-xs leading-relaxed ${
                          goal.completed ? "line-through text-zinc-600" : "text-zinc-300"
                        }`}
                      >
                        {goal.text}
                      </span>
                    )}
                    {isActive && !goal.completed && !isEditing && (
                      <p className="text-[0.6rem] text-cyan-500/70 mt-0.5 flex items-center gap-1">
                        <Play className="h-2.5 w-2.5 flex-shrink-0" /> Actualmente trabajando
                      </p>
                    )}
                  </div>

                  {/* Hover actions */}
                  {!isEditing && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      {/* Reorder up */}
                      {i > 0 && (
                        <button
                          onClick={() => onReorder(goal.id, "up")}
                          className="text-zinc-600 hover:text-zinc-400 transition-colors"
                          aria-label="Mover arriba"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </button>
                      )}
                      {/* Reorder down */}
                      {i < goals.length - 1 && (
                        <button
                          onClick={() => onReorder(goal.id, "down")}
                          className="text-zinc-600 hover:text-zinc-400 transition-colors"
                          aria-label="Mover abajo"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      )}
                      {/* Edit */}
                      <button
                        onClick={() => startEdit(goal)}
                        className="text-zinc-600 hover:text-zinc-400 transition-colors"
                        aria-label="Editar"
                      >
                        <Pen className="h-3 w-3" />
                      </button>
                      {/* Remove */}
                      <button
                        onClick={() => onRemove(goal.id)}
                        className="text-zinc-600 hover:text-zinc-400 transition-colors"
                        aria-label="Eliminar objetivo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {/* Add input */}
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
