"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { SessionNote, ObservationType } from "@/types/session";
import { OBSERVATION_META } from "@/types/session";

interface Props {
  notes: SessionNote[];
  onAdd: (type: ObservationType, content: string) => void;
  onMarkForSummary: (noteId: string) => void;
}

const TYPES: ObservationType[] = ["observacion", "riesgo", "bug", "decision"];

export function SessionObservations({ notes, onAdd, onMarkForSummary }: Props) {
  const [selectedType, setSelectedType] = useState<ObservationType>("observacion");
  const [text, setText] = useState("");

  const handleSubmit = () => {
    if (!text.trim()) return;
    onAdd(selectedType, text.trim());
    setText("");
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
      <p className="mb-3 text-xs font-semibold text-zinc-400">Observaciones de la sesión</p>

      {/* Type selector */}
      <div className="flex gap-1.5 mb-2">
        {TYPES.map(t => {
          const meta = OBSERVATION_META[t];
          return (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              title={meta.label}
              className={`rounded-lg px-2 py-1 text-sm transition-all ${
                selectedType === t
                  ? "bg-zinc-800 border border-white/[0.1] scale-105"
                  : "text-zinc-600 hover:text-zinc-400 border border-transparent"
              }`}
            >
              {meta.emoji}
            </button>
          );
        })}
      </div>

      {/* Input */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSubmit(); } }}
          placeholder="Describe algo que descubriste, un riesgo, un bug o una decisión..."
          className="flex-1 rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/30 focus:outline-none transition-colors"
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim()}
          className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-all disabled:opacity-40"
        >
          ↵
        </button>
      </div>

      {/* Notes feed */}
      {notes.length === 0 ? (
        <p className="text-xs text-zinc-600 text-center py-2">
          Nada anotado todavía. Las observaciones importantes aparecerán aquí.
        </p>
      ) : (
        <div className="space-y-2">
          {[...notes].reverse().map(note => {
            const meta = OBSERVATION_META[note.type];
            return (
              <div
                key={note.id}
                className={`group relative rounded-lg border border-white/[0.04] bg-zinc-900/30 pl-3 pr-3 py-2 border-l-2 ${meta.border}`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-sm flex-shrink-0 mt-0.5">{meta.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-300 leading-relaxed">{note.content}</p>
                    <p className="text-[0.65rem] text-zinc-600 mt-0.5">
                      {format(new Date(note.createdAt), "HH:mm", { locale: es })}
                      {note.markedForSummary && <span className="ml-1.5 text-cyan-600">· en resumen</span>}
                    </p>
                  </div>
                  {!note.markedForSummary && (
                    <button
                      onClick={() => onMarkForSummary(note.id)}
                      className="opacity-0 group-hover:opacity-100 text-[0.65rem] text-zinc-600 hover:text-cyan-400 transition-all flex-shrink-0"
                      title="Añadir al resumen final"
                    >
                      ➜ Resumen
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
