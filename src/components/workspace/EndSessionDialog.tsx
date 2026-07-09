"use client";

import { useState, useEffect } from "react";
import type { WorkSession } from "@/types/session";
import type { CRMTask } from "@/types/crm";
import { STATUS_CONFIG } from "@/types/crm";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Sparkles, PenLine } from "lucide-react";
import { TaskStatusDropdown } from "@/components/crm/TaskStatusDropdown";
import { Spinner } from "@/components/ui/spinner";

interface Props {
  open: boolean;
  session: WorkSession;
  task: CRMTask;
  elapsed: number; // seconds
  onConfirm: (deployStatus: "yes" | "no" | "na", commitStatus: boolean, bitacoraEntry: string, taskStatus: CRMTask["status"]) => void;
  onCancel: () => void;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTime(iso: string): string {
  try {
    return format(new Date(iso), "h:mm a", { locale: es });
  } catch {
    return "—";
  }
}

const DEPLOY_OPTIONS: { label: string; value: "yes" | "no" | "na" }[] = [
  { label: "Sí", value: "yes" },
  { label: "No", value: "no" },
  { label: "No aplica", value: "na" },
];

const DEPLOY_DISPLAY: Record<"yes" | "no" | "na", string> = {
  yes: "Sí",
  no: "No",
  na: "No aplica",
};

export function EndSessionDialog({ open, session, task, elapsed, onConfirm, onCancel }: Props) {
  const [deployStatus, setDeployStatus] = useState<"yes" | "no" | "na" | null>(null);
  const [commitStatus, setCommitStatus] = useState<boolean | null>(null);
  const [taskStatus, setTaskStatus] = useState<CRMTask["status"]>(task.status);
  const [step, setStep] = useState<"blockers-review" | "checklist" | "ai-summary" | "summary">("checklist");
  const [summaryData, setSummaryData] = useState<{
    summary: string;
    bitacoraEntry: string;
    nextStep: string;
  } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(false);
  // "choice" = preguntar manual vs IA; luego pasa a "ai" o "manual".
  const [summaryMode, setSummaryMode] = useState<"choice" | "ai" | "manual">("choice");
  const [editableBitacora, setEditableBitacora] = useState("");

  useEffect(() => {
    if (open) {
      const hasActiveBlockers = session.blockers.filter(b => b.status === "active").length > 0;
      setStep(hasActiveBlockers ? "blockers-review" : "checklist");
      setDeployStatus(null);
      setCommitStatus(null);
      setTaskStatus(task.status);
      setSummaryData(null);
      setSummaryLoading(false);
      setSummaryError(false);
      setSummaryMode("choice");
      setEditableBitacora("");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const completedActivities = session.activities.filter((a) => a.completedAt !== undefined);
  const openBlockers = session.blockers.filter((b) => b.status === "active" || b.status === "waiting");

  const canProceed = deployStatus !== null && commitStatus !== null;

  const handleProceed = () => {
    if (!canProceed) return;
    setStep("ai-summary");
  };

  const handleGenerateWithAi = async () => {
    setSummaryMode("ai");
    setSummaryLoading(true);
    setSummaryError(false);
    try {
      const res = await fetch("/api/workspace/session-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session, elapsed }),
      });
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setSummaryData(data);
      setEditableBitacora(data.bitacoraEntry ?? "");
    } catch {
      setSummaryError(true);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleWriteManually = () => {
    setSummaryMode("manual");
    setSummaryData(null);
    setEditableBitacora("");
  };

  const handleConfirm = () => {
    if (deployStatus === null || commitStatus === null) return;
    onConfirm(deployStatus, commitStatus, editableBitacora, taskStatus);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0F0F12] shadow-2xl overflow-hidden">
        {step === "blockers-review" && (
          <div className="p-6">
            <h2 className="mb-1 text-base font-bold text-zinc-100">Bloqueos sin resolver</h2>
            <p className="mb-4 text-sm text-zinc-500">
              Tienes {session.blockers.filter(b => b.status === "active").length} bloqueo(s) activo(s). ¿Qué deseas hacer?
            </p>
            <div className="mb-4 space-y-2">
              {session.blockers.filter(b => b.status === "active").map(b => (
                <div key={b.id} className="rounded-lg border border-red-500/10 bg-red-500/[0.04] px-3 py-2">
                  <p className="text-xs font-medium text-red-400">🔴 {b.description}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2 mb-4">
              <p className="text-xs text-zinc-500">Puedes:</p>
              <ul className="text-xs text-zinc-400 space-y-1 list-disc list-inside">
                <li>Dejarlos abiertos para la siguiente sesión</li>
                <li>Resolverlos desde el panel de bloqueos antes de finalizar</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStep("checklist")}
                className="flex-1 rounded-lg bg-zinc-800 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700 transition-all"
              >
                Continuar de todas formas
              </button>
              <button
                onClick={onCancel}
                className="rounded-lg border border-white/[0.06] px-4 py-2.5 text-sm text-zinc-500 hover:text-zinc-300 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {step === "checklist" && (
          <div className="p-6">
            <h2 className="mb-1 text-base font-bold text-zinc-100">Finalizar sesión</h2>
            <p className="mb-5 text-sm text-zinc-500">Responde antes de cerrar</p>

            {/* Deploy question */}
            <div className="mb-4">
              <p className="mb-2 text-sm font-medium text-zinc-300">¿Realizaste deploy?</p>
              <div className="flex gap-2">
                {DEPLOY_OPTIONS.map(({ label, value }) => {
                  const isSelected = deployStatus === value;
                  return (
                    <button
                      key={value}
                      onClick={() => setDeployStatus(value)}
                      className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-all ${
                        isSelected
                          ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                          : "border-white/[0.06] bg-zinc-900/40 text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Commit question */}
            <div className="mb-6">
              <p className="mb-2 text-sm font-medium text-zinc-300">¿Realizaste commit y push?</p>
              <div className="flex gap-2">
                {([true, false] as const).map((val) => {
                  const isSelected = commitStatus === val;
                  return (
                    <button
                      key={String(val)}
                      onClick={() => setCommitStatus(val)}
                      className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-all ${
                        isSelected
                          ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                          : "border-white/[0.06] bg-zinc-900/40 text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {val ? "Sí" : "No"}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Task status */}
            <div className="mb-6">
              <p className="mb-2 text-sm font-medium text-zinc-300">Estado de la tarea</p>
              <TaskStatusDropdown status={taskStatus} onChange={setTaskStatus} />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleProceed}
                disabled={!canProceed}
                className="flex-1 rounded-lg bg-zinc-800 py-2.5 text-sm font-medium text-zinc-200 transition-all hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Ver resumen
              </button>
              <button
                onClick={onCancel}
                className="rounded-lg border border-white/[0.06] px-4 py-2.5 text-sm text-zinc-500 hover:text-zinc-300 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {step === "ai-summary" && summaryMode === "choice" && (
          <div className="p-6">
            <h2 className="mb-1 text-base font-bold text-zinc-100">Bitácora de la sesión</h2>
            <p className="mb-5 text-sm text-zinc-500">¿Cómo quieres redactarla?</p>

            <div className="space-y-2 mb-4">
              <button
                onClick={handleGenerateWithAi}
                className="flex w-full items-center gap-3 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.06] px-4 py-3 text-left transition-all hover:bg-cyan-500/10"
              >
                <Sparkles className="h-4 w-4 flex-shrink-0 text-cyan-400" />
                <div>
                  <p className="text-sm font-medium text-cyan-300">Generar con IA</p>
                  <p className="text-xs text-zinc-500">Resume la sesión automáticamente, editable después</p>
                </div>
              </button>
              <button
                onClick={handleWriteManually}
                className="flex w-full items-center gap-3 rounded-lg border border-white/[0.06] bg-zinc-900/40 px-4 py-3 text-left transition-all hover:bg-zinc-900/60"
              >
                <PenLine className="h-4 w-4 flex-shrink-0 text-zinc-400" />
                <div>
                  <p className="text-sm font-medium text-zinc-200">Escribir yo</p>
                  <p className="text-xs text-zinc-500">Redacta tu propia entrada para la bitácora</p>
                </div>
              </button>
            </div>

            <button
              onClick={onCancel}
              className="w-full rounded-lg border border-white/[0.06] px-4 py-2.5 text-sm text-zinc-500 hover:text-zinc-300 transition-all"
            >
              Cancelar
            </button>
          </div>
        )}

        {step === "ai-summary" && summaryMode !== "choice" && (
          <div className="p-6">
            <div className="mb-4 flex items-center gap-2">
              {summaryMode === "ai" ? (
                <Sparkles className="h-4 w-4 text-cyan-400" />
              ) : (
                <PenLine className="h-4 w-4 text-zinc-400" />
              )}
              <h2 className="text-sm font-bold text-zinc-100">
                {summaryMode === "ai" ? "Resumen IA" : "Escribir bitácora"}
              </h2>
            </div>

            {summaryLoading && (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Spinner size="md" className="text-cyan-400" />
                <p className="text-xs text-zinc-500">Generando resumen...</p>
              </div>
            )}

            {summaryError && (
              <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <p className="text-xs text-red-400">No se pudo generar el resumen. Puedes escribirla manualmente abajo.</p>
              </div>
            )}

            {summaryData && !summaryLoading && (
              <div className="mb-4 space-y-3">
                <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">Resumen</p>
                  <p className="text-xs text-zinc-300 leading-relaxed">{summaryData.summary}</p>
                </div>
                <div className="rounded-xl border border-cyan-500/10 bg-cyan-500/[0.03] p-3">
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-cyan-600">Siguiente paso</p>
                  <p className="text-xs text-cyan-300">{summaryData.nextStep}</p>
                </div>
              </div>
            )}

            {!summaryLoading && (
              <div className="mb-4">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">Entrada para Bitácora</p>
                <textarea
                  value={editableBitacora}
                  onChange={(e) => setEditableBitacora(e.target.value)}
                  rows={5}
                  placeholder="Describe qué se hizo en esta sesión..."
                  className="w-full resize-none rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-2 text-xs text-zinc-300 placeholder:text-zinc-600 focus:border-cyan-500/30 focus:outline-none transition-colors"
                />
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setStep("summary")}
                disabled={summaryLoading}
                className="flex-1 rounded-lg bg-zinc-800 py-2.5 text-sm font-medium text-zinc-200 transition-all hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {summaryLoading ? "Generando..." : "Continuar"}
              </button>
              <button
                onClick={() => setSummaryMode("choice")}
                disabled={summaryLoading}
                className="rounded-lg border border-white/[0.06] px-4 py-2.5 text-sm text-zinc-500 hover:text-zinc-300 transition-all disabled:opacity-40"
              >
                Volver
              </button>
            </div>
          </div>
        )}

        {step === "summary" && (
          <div className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-400" />
              <h2 className="text-sm font-bold text-zinc-100">Sesión finalizada</h2>
            </div>

            <div className="mb-4 space-y-1.5 rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Proyecto</span>
                <span className="text-zinc-300">{session.projectName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Tarea</span>
                <span className="text-zinc-300">{session.taskName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Hora inicio</span>
                <span className="text-zinc-300">{formatTime(session.startedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Hora final</span>
                <span className="text-zinc-300">{formatTime(new Date().toISOString())}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Tiempo total</span>
                <span className="font-semibold text-zinc-200">{formatElapsed(elapsed)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Actividades</span>
                <span className="text-zinc-300">{completedActivities.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Notas</span>
                <span className="text-zinc-300">{session.notes.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Bloqueos abiertos</span>
                <span className={openBlockers.length > 0 ? "font-medium text-red-400" : "text-zinc-300"}>
                  {openBlockers.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Deploy</span>
                <span
                  className={
                    deployStatus === "yes"
                      ? "text-green-400"
                      : deployStatus === "no"
                      ? "text-red-400"
                      : "text-zinc-500"
                  }
                >
                  {deployStatus !== null ? DEPLOY_DISPLAY[deployStatus] : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Commit y push</span>
                <span className={commitStatus ? "text-green-400" : "text-red-400"}>
                  {commitStatus ? "Sí" : "No"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Estado de la tarea</span>
                <span className={STATUS_CONFIG[taskStatus].text}>
                  {STATUS_CONFIG[taskStatus].label}
                </span>
              </div>
            </div>

            {editableBitacora.trim() ? (
              <div className="mb-4 rounded-xl border border-white/[0.06] bg-zinc-900/20 p-3">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">Se escribirá en Bitácora</p>
                <p className="text-xs text-zinc-500 leading-relaxed line-clamp-3">{editableBitacora}</p>
              </div>
            ) : (
              <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="text-xs text-amber-400">No hay entrada de Bitácora. Puedes agregarla manualmente después.</p>
              </div>
            )}

            <button
              onClick={handleConfirm}
              className="w-full rounded-lg bg-cyan-500/10 border border-cyan-500/20 py-2.5 text-sm font-medium text-cyan-300 transition-all hover:bg-cyan-500/20"
            >
              Confirmar y cerrar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
