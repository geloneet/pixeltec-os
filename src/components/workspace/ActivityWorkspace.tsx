"use client";

import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
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
  const [completing, setCompleting] = useState<string | null>(null);
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
    setCompleting(inProgress?.id ?? null);
    setTimeout(() => {
      onDone();
      onStart(newText.trim(), estimate);
      setNewText("");
      setEstimate(undefined);
      setShowStartForm(false);
      setShowConfirm(false);
      setCompleting(null);
    }, 200);
  };

  const handleDone = () => {
    if (inProgress) {
      setCompleting(inProgress.id);
      setTimeout(() => {
        onDone();
        setCompleting(null);
      }, 200);
    }
  };

  const totalCount = activities.length;
  const completedCount = completed.length;
  const inProgressCount = inProgress ? 1 : 0;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-zinc-400">Actividades</p>
        {totalCount > 0 && (
          <span className="text-[0.65rem] text-zinc-600">
            {completedCount} completada{completedCount !== 1 ? "s" : ""}
            {inProgressCount > 0 && " · 1 en progreso"}
          </span>
        )}
      </div>

      {/* In-progress (pinned) */}
      {inProgress && (
        <div
          className={`mb-3 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.04] p-3 transition-opacity duration-200 ${
            completing === inProgress.id ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="flex items-start gap-2">
            <span className="text-cyan-400 text-xs mt-0.5 flex-shrink-0">▶</span>
            <div className="flex-1 min-w-0">
              <input
                ref={inputRef}
                type="text"
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onBlur={() => { if (editText.trim()) onUpdateText(editText.trim()); }}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (editText.trim()) onUpdateText(editText.trim()); inputRef.current?.blur(); }}}
                className="w-full bg-transparent text-sm text-zinc-200 focus:outline-none"
              />
              <p className="text-[0.65rem] text-zinc-600 mt-0.5">
                En progreso · <LiveDuration startedAt={inProgress.startedAt} />
                {inProgress.estimatedMinutes && (
                  <span className="ml-1.5">· Est: {inProgress.estimatedMinutes >= 60 ? `${inProgress.estimatedMinutes / 60}h` : `${inProgress.estimatedMinutes} min`}</span>
                )}
              </p>
            </div>
            <button
              onClick={handleDone}
              className="flex-shrink-0 rounded-lg border border-green-500/20 bg-green-500/[0.06] px-2.5 py-1 text-[0.65rem] font-medium text-green-400 hover:bg-green-500/10 transition-all"
            >
              ✓ Finalizar
            </button>
          </div>
        </div>
      )}

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
              className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* New activity form */}
      {showStartForm && !showConfirm && (
        <div className="mb-3 rounded-lg border border-white/[0.06] bg-zinc-900/40 p-3 space-y-2">
          <input
            autoFocus
            type="text"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleStartRequest(); } if (e.key === "Escape") { setShowStartForm(false); setNewText(""); }}}
            placeholder="Describe la actividad..."
            className="w-full bg-transparent border-b border-white/[0.06] pb-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/30 transition-colors"
          />
          <div className="flex items-center gap-1.5">
            <span className="text-[0.65rem] text-zinc-600">Estimación:</span>
            {ESTIMATE_OPTIONS.map(opt => (
              <button
                key={String(opt.value)}
                onClick={() => setEstimate(opt.value)}
                className={`rounded px-2 py-0.5 text-[0.65rem] transition-all ${
                  estimate === opt.value
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                    : "text-zinc-600 hover:text-zinc-400 border border-transparent"
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
              className="flex-1 rounded-lg bg-zinc-800 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition-all disabled:opacity-40"
            >
              Iniciar actividad
            </button>
            <button
              onClick={() => { setShowStartForm(false); setNewText(""); setEstimate(undefined); }}
              className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Completed timeline */}
      {completed.length > 0 && (
        <div className="mb-3">
          <p className="text-[0.65rem] font-medium text-zinc-600 mb-2 uppercase tracking-wider">Hoy</p>
          <div className="space-y-0">
            {completed.map((activity, i) => {
              const real = formatDuration(activity.startedAt, activity.completedAt);
              const est = activity.estimatedMinutes;
              return (
                <div key={activity.id} className="flex gap-2.5">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 flex-shrink-0 rounded-full bg-zinc-600 mt-1.5" />
                    {i < completed.length - 1 && (
                      <div className="w-px flex-1 bg-white/[0.04] mt-1" style={{ minHeight: "16px" }} />
                    )}
                  </div>
                  <div className="pb-2.5 min-w-0">
                    <p className="text-xs text-zinc-400 leading-snug">
                      <span className="text-green-500/70 mr-1.5">✓</span>
                      {activity.description}
                    </p>
                    <p className="text-[0.65rem] text-zinc-600">
                      {real}
                      {activity.completedAt && ` · completada ${formatTime(activity.completedAt)}`}
                      {est && ` · Est: ${est >= 60 ? `${est / 60}h` : `${est}m`}`}
                    </p>
                  </div>
                </div>
              );
            })}
            <div className="flex gap-2.5">
              <div className="flex flex-col items-center">
                <div className="h-2 w-2 flex-shrink-0 rounded-full border border-zinc-700 mt-1.5" />
              </div>
              <p className="text-[0.65rem] text-zinc-700 pb-2">Sesión iniciada</p>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!inProgress && completed.length === 0 && !showStartForm && (
        <p className="text-xs text-zinc-600 mb-3">Ninguna actividad registrada aún.</p>
      )}

      {/* Start button */}
      {!showStartForm && (
        <button
          onClick={() => setShowStartForm(true)}
          className="w-full rounded-lg border border-dashed border-white/[0.08] py-2 text-xs text-zinc-600 hover:text-zinc-400 hover:border-white/[0.12] transition-all"
        >
          + Iniciar nueva actividad
        </button>
      )}
    </div>
  );
}
