"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, Check, Layers, AlertTriangle } from "lucide-react";
import type { SessionNote, ObservationType } from "@/types/session";
import { OBSERVATION_META } from "@/types/session";

interface Props {
  notes: SessionNote[];
  onAdd: (type: ObservationType, content: string) => void;
  onMarkForSummary: (noteId: string) => void;
  onConvertToTask: (content: string) => void;
  onCreateBlocker: (content: string) => void;
}

const TYPES: ObservationType[] = ["observacion", "riesgo", "bug", "decision"];

export function SessionObservations({ notes, onAdd, onMarkForSummary, onConvertToTask, onCreateBlocker }: Props) {
  const [selectedType, setSelectedType] = useState<ObservationType>("observacion");
  const [text, setText] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!text.trim()) return;
    onAdd(selectedType, text.trim());
    setText("");
  };

  const handleCopy = (note: SessionNote) => {
    navigator.clipboard.writeText(note.content);
    setCopiedId(note.id);
    setTimeout(() => setCopiedId(null), 1500);
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
          <AnimatePresence initial={false}>
            {[...notes].reverse().map(note => {
              const meta = OBSERVATION_META[note.type];
              const isCopied = copiedId === note.id;
              return (
                <motion.div
                  key={note.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className={`group relative rounded-lg border border-white/[0.04] pl-3 pr-3 py-2 border-l-2 ${meta.border} ${meta.tint}`}
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
                  </div>

                  {/* Hover action bar */}
                  <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Convert to task */}
                    <button
                      onClick={() => onConvertToTask(note.content)}
                      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.6rem] border border-white/[0.06] text-zinc-500 hover:text-zinc-200 hover:border-zinc-600 transition-all"
                      title="Convertir en tarea"
                    >
                      <Layers className="h-2.5 w-2.5" />
                      Convertir en tarea
                    </button>
                    {/* Create blocker */}
                    <button
                      onClick={() => onCreateBlocker(note.content)}
                      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.6rem] border border-white/[0.06] text-zinc-500 hover:text-red-400 hover:border-red-500/30 transition-all"
                      title="Crear bloqueo"
                    >
                      <AlertTriangle className="h-2.5 w-2.5" />
                      Crear bloqueo
                    </button>
                    {/* Copy */}
                    <button
                      onClick={() => handleCopy(note)}
                      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.6rem] border border-white/[0.06] text-zinc-500 hover:text-zinc-200 hover:border-zinc-600 transition-all"
                    >
                      {isCopied ? <Check className="h-2.5 w-2.5 text-green-400" /> : <Copy className="h-2.5 w-2.5" />}
                      {isCopied ? "Copiado" : "Copiar"}
                    </button>
                    {/* Mark for summary */}
                    {!note.markedForSummary && (
                      <button
                        onClick={() => onMarkForSummary(note.id)}
                        className="ml-auto rounded px-1.5 py-0.5 text-[0.6rem] text-zinc-600 hover:text-cyan-400 transition-colors"
                        title="Añadir al resumen final"
                      >
                        ➜ Resumen
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
