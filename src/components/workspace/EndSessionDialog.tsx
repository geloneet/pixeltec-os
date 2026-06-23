"use client";

import { useState, useEffect } from "react";
import type { WorkSession } from "@/types/session";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  open: boolean;
  session: WorkSession;
  elapsed: number; // seconds
  onConfirm: (deployStatus: "yes" | "no" | "na", commitStatus: boolean) => void;
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

export function EndSessionDialog({ open, session, elapsed, onConfirm, onCancel }: Props) {
  const [deployStatus, setDeployStatus] = useState<"yes" | "no" | "na" | null>(null);
  const [commitStatus, setCommitStatus] = useState<boolean | null>(null);
  const [step, setStep] = useState<"checklist" | "summary">("checklist");

  useEffect(() => {
    if (open) {
      setStep("checklist");
    }
  }, [open]);

  if (!open) return null;

  const completedActivities = session.activities.filter((a) => a.completedAt !== undefined);
  const openBlockers = session.blockers.filter((b) => !b.resolved);

  const canProceed = deployStatus !== null && commitStatus !== null;

  const handleProceed = () => {
    if (!canProceed) return;
    setStep("summary");
  };

  const handleConfirm = () => {
    if (deployStatus === null || commitStatus === null) return;
    onConfirm(deployStatus, commitStatus);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0F0F12] shadow-2xl overflow-hidden">
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
            </div>

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
