"use client";

import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
import { Pencil, Play, Check, CornerDownLeft } from "lucide-react";
import type { SessionActivity } from "@/types/session";

interface Props {
  activities: SessionActivity[];
  onStart: (description: string, estimatedMinutes?: number) => void;
  onDone: () => void;
  onUpdateText: (description: string) => void;
}

const ESTIMATE_OPTIONS: { label: string; value: number | undefined }[] = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 h",    value: 60 },
  { label: "—",      value: undefined },
];

function formatTime(iso: string): string {
  try { return format(new Date(iso), "HH:mm", { locale: es }); } catch { return "—"; }
}

function formatDuration(startIso: string, endIso?: string): string {
  try {
    const start = new Date(startIso).getTime();
    const end = endIso ? new Date(endIso).getTime() : Date.now();
    const mins = Math.floor((end - start) / 60000);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  } catch { return "—"; }
}

function getActivityMinutes(startIso: string, endIso?: string): number {
  try {
    const start = new Date(startIso).getTime();
    const end = endIso ? new Date(endIso).getTime() : Date.now();
    return Math.floor((end - start) / 60000);
  } catch { return 0; }
}

/** Energy bar for the in-progress activity */
function EnergyBar({ startedAt, estimatedMinutes }: { startedAt: string; estimatedMinutes?: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const mins = getActivityMinutes(startedAt);
  const cap = estimatedMinutes ?? 90;
  const pct = Math.min((mins / cap) * 100, 100);

  let barColor = "bg-green-500/70";
  let label = "";
  if (mins >= 150) { barColor = "bg-red-500/70"; label = "Muy larga"; }
  else if (mins >= 90) { barColor = "bg-amber-500/70"; label = "Larga"; }

  return (
    <div className="mt-1.5">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[0.6rem] text-muted-foreground/60">Energía</span>
        {label && (
          <span className={`text-[0.6rem] ${mins >= 150 ? "text-red-400/80" : "text-amber-400/80"}`}>
            {label}
          </span>
        )}
      </div>
      <div className="h-0.5 rounded-full bg-secondary overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function LiveDuration({ startedAt }: { startedAt: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  return <span>{formatDuration(startedAt)}</span>;
}

export function ActivityWorkspace({ activities, onStart, onDone, onUpdateText }: Props) {
  const inProgress = activities.find(a => !a.completedAt) ?? null;
  const completed = [...activities.filter(a => !!a.completedAt)].reverse();

  const [showStartForm, setShowStartForm] = useState(false);
  const [newText, setNewText] = useState("");
  const [estimate, setEstimate] = useState<number | undefined>(undefined);
  const [showConfirm, setShowConfirm] = useState(false);
  const [editText, setEditText] = useState(inProgress?.description ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditText(inProgress?.description ?? "");
  }, [inProgress?.description]);

  const handleStartRequest = () => {
    if (!newText.trim()) return;
    if (inProgress) {
      setShowConfirm(true);
    } else {
      onStart(newText.trim(), estimate);
      setNewText("");
      setEstimate(undefined);
      setShowStartForm(false);
    }
  };

  const handleConfirmReplace = () => {
    onDone();
    onStart(newText.trim(), estimate);
    setNewText("");
    setEstimate(undefined);
    setShowStartForm(false);
    setShowConfirm(false);
  };

  const handleDone = () => {
    if (inProgress) onDone();
  };

  const totalCount = activities.length;
  const completedCount = completed.length;
  const inProgressCount = inProgress ? 1 : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground">Actividades</p>
        {totalCount > 0 && (
          <span className="text-[0.65rem] text-muted-foreground/70">
            {completedCount} completada{completedCount !== 1 ? "s" : ""}
            {inProgressCount > 0 && " · 1 en progreso"}
          </span>
        )}
      </div>

      {/* In-progress (pinned) */}
      <AnimatePresence>
        {inProgress && (
          <motion.div
            key={inProgress.id}
            layout
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="group mb-3 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.04] p-3"
          >
            <div className="flex items-start gap-2">
              <Play className="h-3 w-3 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <input
                  ref={inputRef}
                  type="text"
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onBlur={() => { if (editText.trim()) onUpdateText(editText.trim()); }}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (editText.trim()) onUpdateText(editText.trim()); inputRef.current?.blur(); }}}
                  className="w-full bg-transparent text-sm text-foreground focus:outline-none"
                />
                <p className="text-[0.65rem] text-muted-foreground/70 mt-0.5">
                  En progreso · <LiveDuration startedAt={inProgress.startedAt} />
                  {inProgress.estimatedMinutes && (
                    <span className="ml-1.5">· Est: {inProgress.estimatedMinutes >= 60 ? `${inProgress.estimatedMinutes / 60}h` : `${inProgress.estimatedMinutes} min`}</span>
                  )}
                </p>
                <EnergyBar startedAt={inProgress.startedAt} estimatedMinutes={inProgress.estimatedMinutes} />
              </div>

              {/* Hover actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Edit (pencil) — reveals input focus */}
                <button
                  onClick={() => inputRef.current?.focus()}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/70 hover:text-muted-foreground"
                  title="Editar"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={handleDone}
                  className="rounded-lg border border-green-500/20 bg-green-500/[0.06] px-2.5 py-1 text-[0.65rem] font-medium text-green-400 hover:bg-green-500/10 transition-all"
                >
                  <Check className="h-3 w-3" /> Finalizar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm replace dialog */}
      {showConfirm && (
        <div className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3 space-y-2">
          <p className="text-xs text-amber-300">¿Deseas finalizar la actividad actual e iniciar una nueva?</p>
          <div className="flex gap-2">
            <button
              onClick={handleConfirmReplace}
              className="flex-1 rounded-lg bg-amber-500/10 border border-amber-500/20 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-all"
            >
              Finalizar e iniciar
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* New activity form */}
      {showStartForm && !showConfirm && (
        <div className="mb-3 rounded-lg border border-border bg-secondary/40 p-3 space-y-2">
          <input
            autoFocus
            type="text"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleStartRequest(); } if (e.key === "Escape") { setShowStartForm(false); setNewText(""); }}}
            placeholder="Describe la actividad..."
            className="w-full bg-transparent border-b border-border pb-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-500/30 transition-colors"
          />
          <div className="flex items-center gap-1.5">
            <span className="text-[0.65rem] text-muted-foreground/70">Estimación:</span>
            {ESTIMATE_OPTIONS.map(opt => (
              <button
                key={String(opt.value)}
                onClick={() => setEstimate(opt.value)}
                className={`rounded px-2 py-0.5 text-[0.65rem] transition-all ${
                  estimate === opt.value
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                    : "text-muted-foreground/70 hover:text-muted-foreground border border-transparent"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleStartRequest}
              disabled={!newText.trim()}
              className="flex-1 rounded-lg bg-secondary py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-all disabled:opacity-40"
            >
              Iniciar actividad
            </button>
            <button
              onClick={() => { setShowStartForm(false); setNewText(""); setEstimate(undefined); }}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Completed timeline — compact */}
      {completed.length > 0 && (
        <div className="mb-3">
          <p className="text-[0.65rem] font-medium text-muted-foreground/70 mb-1.5 uppercase tracking-wider">Hoy</p>
          <div className="space-y-0">
            <AnimatePresence initial={false}>
              {completed.map((activity, i) => {
                const real = formatDuration(activity.startedAt, activity.completedAt);
                const est = activity.estimatedMinutes;
                return (
                  <motion.div
                    key={activity.id}
                    layout
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="flex gap-2"
                  >
                    {/* Timeline rail */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/40 mt-1" />
                      {i < completed.length - 1 && (
                        <div className="w-px flex-1 bg-border mt-1" style={{ minHeight: "14px" }} />
                      )}
                    </div>
                    <div className="pb-2 min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-[0.65rem] text-muted-foreground/70 tabular-nums flex-shrink-0">
                          {formatTime(activity.startedAt)}
                        </span>
                        <p className="text-xs text-muted-foreground leading-snug">
                          <Check className="h-3 w-3 text-green-500/70 flex-shrink-0 inline-block mr-1 -mb-0.5" />
                          {activity.description}
                        </p>
                      </div>
                      <p className="text-[0.65rem] text-muted-foreground/60 pl-[calc(2.75rem)]">
                        {real}{est && ` · Est: ${est >= 60 ? `${est / 60}h` : `${est}m`}`}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {/* Session start */}
            <div className="flex gap-2">
              <div className="flex flex-col items-center">
                <div className="h-2 w-2 rounded-full border border-border mt-1" />
              </div>
              <p className="text-[0.65rem] text-muted-foreground/60 pb-1.5">Sesión iniciada</p>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!inProgress && completed.length === 0 && !showStartForm && (
        <div className="flex flex-col items-center text-center py-4 mb-2 gap-2">
          <div className="h-8 w-8 rounded-xl bg-secondary flex items-center justify-center">
            <Play className="h-4 w-4 text-muted-foreground/70" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Comienza tu primera actividad</p>
            <p className="text-[0.65rem] text-muted-foreground/70 mt-0.5 max-w-[200px] leading-relaxed">
              Las actividades registran en qué inviertes tu tiempo durante la sesión.
            </p>
          </div>
        </div>
      )}

      {/* Start button — protagonista */}
      {!showStartForm && (
        <button
          onClick={() => setShowStartForm(true)}
          className="w-full rounded-lg border border-cyan-500/20 bg-cyan-500/[0.03] hover:bg-cyan-500/[0.08] hover:border-cyan-500/30 py-2.5 text-xs font-medium text-cyan-600/80 hover:text-cyan-400 transition-all"
        >
          + Nueva actividad
        </button>
      )}
    </div>
  );
}
