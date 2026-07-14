"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
import {
  Copy, Check, Layers, AlertTriangle,
  Lightbulb, ShieldAlert, Bug, GitMerge,
  CornerDownLeft, BookmarkPlus,
} from "lucide-react";
import type { SessionNote, ObservationType } from "@/types/session";
import { OBSERVATION_META } from "@/types/session";
import type { CRMTask } from "@/types/crm";
import { PRIORITIES } from "@/types/crm";

interface NewTaskData {
  name: string;
  desc: string;
  prio: CRMTask["prio"];
}

interface Props {
  notes: SessionNote[];
  onAdd: (type: ObservationType, content: string) => void;
  onMarkForSummary: (noteId: string) => void;
  onConvertToTask: (data: NewTaskData) => void;
  onCreateBlocker: (content: string) => void;
}

const TYPES: ObservationType[] = ["observacion", "riesgo", "bug", "decision"];
const TASK_PRIOS: CRMTask["prio"][] = ["urgent_important", "important", "urgent", "low"];

function truncate(content: string, max: number): string {
  return content.length > max ? content.slice(0, max - 2).trimEnd() + "…" : content;
}

// Map to lucide components — unique, intentional icons vs generic emoji
const OBS_ICONS: Record<ObservationType, React.ComponentType<{ className?: string }>> = {
  observacion: Lightbulb,
  riesgo:      ShieldAlert,
  bug:         Bug,
  decision:    GitMerge,
};

export function SessionObservations({ notes, onAdd, onMarkForSummary, onConvertToTask, onCreateBlocker }: Props) {
  const [selectedType, setSelectedType] = useState<ObservationType>("observacion");
  const [text, setText] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // "Convertir en tarea" — formulario inline pre-llenado, mismo criterio que
  // "+ Reportar" en Bloqueos: pide los campos reales antes de crear.
  const [taskFormNoteId, setTaskFormNoteId] = useState<string | null>(null);
  const [taskName, setTaskName] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskPrio, setTaskPrio] = useState<CRMTask["prio"]>("important");

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

  const openTaskForm = (note: SessionNote) => {
    setTaskFormNoteId(note.id);
    setTaskName(truncate(note.content, 60));
    setTaskDesc(note.content);
    setTaskPrio("important");
  };

  const handleCreateTask = () => {
    if (!taskName.trim()) return;
    onConvertToTask({ name: taskName.trim(), desc: taskDesc.trim(), prio: taskPrio });
    setTaskFormNoteId(null);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-xs font-semibold text-muted-foreground">Observaciones de la sesión</p>

      {/* Type selector */}
      <div className="flex gap-1.5 mb-2">
        {TYPES.map(t => {
          const meta = OBSERVATION_META[t];
          const Icon = OBS_ICONS[t];
          const isSelected = selectedType === t;
          return (
            <div key={t} className="group/tip relative">
              <button
                onClick={() => setSelectedType(t)}
                className={`rounded-lg px-2.5 py-1.5 transition-all ${
                  isSelected
                    ? `bg-secondary border border-border ${meta.iconColor}`
                    : "text-muted-foreground/70 hover:text-muted-foreground border border-transparent"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
              {/* Hover label tooltip */}
              {!isSelected && (
                <span className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-popover px-1.5 py-0.5 text-[0.6rem] text-popover-foreground opacity-0 group-hover/tip:opacity-100 transition-opacity z-10 border border-border">
                  {meta.label}
                </span>
              )}
            </div>
          );
        })}
        <span className="text-[0.65rem] text-muted-foreground/70 self-center ml-1">
          {OBSERVATION_META[selectedType].label}
        </span>
      </div>

      {/* Input */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSubmit(); } }}
          placeholder="Describe algo que descubriste, un riesgo, un bug o una decisión..."
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-cyan-500/30 focus:outline-none transition-colors"
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim()}
          title="Agregar (Enter)"
          className="rounded-lg border border-border bg-background px-3 py-2 text-muted-foreground hover:text-foreground transition-all disabled:opacity-40"
        >
          <CornerDownLeft className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Notes feed */}
      {notes.length === 0 ? (
        <div className="flex items-center gap-3 py-1">
          <Lightbulb className="h-5 w-5 text-muted-foreground/60 flex-shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground font-medium">Anota lo que descubres</p>
            <p className="text-[0.65rem] text-muted-foreground/70">Decisiones · Bugs · Riesgos · Descubrimientos</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {[...notes].reverse().map(note => {
              const meta = OBSERVATION_META[note.type];
              const Icon = OBS_ICONS[note.type];
              const isCopied = copiedId === note.id;
              return (
                <motion.div
                  key={note.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className={`group relative rounded-lg border border-border pl-3 pr-3 py-2 border-l-2 ${meta.border} ${meta.tint}`}
                >
                  <div className="flex items-start gap-2">
                    <Icon className={`h-3.5 w-3.5 flex-shrink-0 mt-0.5 ${meta.iconColor}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground leading-relaxed">{note.content}</p>
                      <p className="text-[0.65rem] text-muted-foreground/70 mt-0.5">
                        {format(new Date(note.createdAt), "HH:mm", { locale: es })}
                        {note.markedForSummary && <span className="ml-1.5 text-cyan-600">· en resumen</span>}
                      </p>
                    </div>
                  </div>

                  {/* Hover action bar */}
                  <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openTaskForm(note)}
                      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.6rem] border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all"
                      title="Convertir en tarea"
                    >
                      <Layers className="h-2.5 w-2.5" />
                      Convertir en tarea
                    </button>
                    <button
                      onClick={() => onCreateBlocker(note.content)}
                      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.6rem] border border-border text-muted-foreground hover:text-red-400 hover:border-red-500/30 transition-all"
                      title="Crear bloqueo"
                    >
                      <AlertTriangle className="h-2.5 w-2.5" />
                      Crear bloqueo
                    </button>
                    <button
                      onClick={() => handleCopy(note)}
                      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.6rem] border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all"
                    >
                      {isCopied ? <Check className="h-2.5 w-2.5 text-green-400" /> : <Copy className="h-2.5 w-2.5" />}
                      {isCopied ? "Copiado" : "Copiar"}
                    </button>
                    {!note.markedForSummary && (
                      <button
                        onClick={() => onMarkForSummary(note.id)}
                        className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.6rem] text-muted-foreground/70 hover:text-cyan-400 transition-colors"
                        title="Añadir al resumen final"
                      >
                        <BookmarkPlus className="h-2.5 w-2.5" />
                        Resumen
                      </button>
                    )}
                  </div>

                  {/* Formulario inline — "Convertir en tarea" */}
                  {taskFormNoteId === note.id && (
                    <div className="mt-2 space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
                      <input
                        type="text"
                        value={taskName}
                        onChange={e => setTaskName(e.target.value)}
                        placeholder="Nombre de la tarea"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-cyan-500/30 focus:outline-none transition-colors"
                      />
                      <textarea
                        value={taskDesc}
                        onChange={e => setTaskDesc(e.target.value)}
                        placeholder="Descripción"
                        rows={2}
                        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-cyan-500/30 focus:outline-none transition-colors"
                      />
                      <div className="flex gap-1.5 flex-wrap">
                        <span className="text-[0.65rem] text-muted-foreground/70 self-center">Prioridad:</span>
                        {TASK_PRIOS.map(p => (
                          <button
                            key={p}
                            onClick={() => setTaskPrio(p)}
                            className={`rounded px-2 py-0.5 text-[0.65rem] border transition-all ${
                              taskPrio === p
                                ? "border-border text-foreground bg-secondary"
                                : "border-transparent text-muted-foreground/70 hover:text-muted-foreground"
                            }`}
                          >
                            {PRIORITIES[p].label}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleCreateTask}
                          disabled={!taskName.trim()}
                          className="flex-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20 transition-all disabled:opacity-40"
                        >
                          Crear tarea
                        </button>
                        <button
                          onClick={() => setTaskFormNoteId(null)}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-all"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
