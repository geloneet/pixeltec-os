"use client";

import { ArrowLeft, Check, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import type { WorkSession } from "@/types/session";
import type { CRMTask } from "@/types/crm";

interface Props {
  session: WorkSession;
  task: CRMTask;
  elapsed: number;
}

function focusLabel(session: WorkSession, elapsed: number): string | null {
  if (elapsed < 300) return null;
  const activeBlockers = session.blockers.filter(b => b.status === "active");
  if (activeBlockers.length > 0) return "Bloqueado";
  const hasActiveActivity = session.activities.some(a => !a.completedAt);
  const completedCount = session.activities.filter(a => !!a.completedAt).length;
  if (elapsed > 2700 && !hasActiveActivity && completedCount === 0) return "Foco bajo";
  if (completedCount >= 2 || hasActiveActivity) return "Foco alto";
  if (completedCount >= 1) return "Foco medio";
  return "Foco alto";
}

export type FinalizeState = {
  label: React.ReactNode;
  className: string;
  disabled: boolean;
};

export function getFinalizeState(session: WorkSession): FinalizeState {
  const activeBlockers = session.blockers.filter(b => b.status === "active");
  if (activeBlockers.length > 0) {
    return {
      label: "Resolver bloqueos primero",
      className: "opacity-50 cursor-not-allowed border-border bg-secondary/20 text-muted-foreground",
      disabled: true,
    };
  }
  const goals = session.sessionGoals ?? [];
  const pendingGoals = goals.filter(g => !g.completed).length;
  if (pendingGoals > 0) {
    return {
      label: (
        <span className="flex items-center gap-1.5">
          Finalizar
          <span className="flex items-center gap-0.5 text-amber-400/80">
            <AlertTriangle className="h-3 w-3" />
            {pendingGoals} pendiente{pendingGoals !== 1 ? "s" : ""}
          </span>
        </span>
      ),
      className: "border-red-500/20 bg-red-500/[0.06] text-red-400 hover:bg-red-500/10 hover:border-red-500/30",
      disabled: false,
    };
  }
  return {
    label: (
      <span className="flex items-center gap-1.5">
        <Check className="h-3 w-3" /> Listo para cerrar
      </span>
    ),
    className: "border-green-500/20 bg-green-500/[0.06] text-green-400 hover:bg-green-500/10 hover:border-green-500/30",
    disabled: false,
  };
}

export function WorkspaceHeader({ session, task, elapsed }: Props) {
  const router = useRouter();

  return (
    <div className="flex items-center border-b border-border bg-card px-6 py-2.5 min-h-[48px]">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          onClick={() => router.push(`/proyectos/${session.projectId}?tab=tareas`)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        >
          <ArrowLeft className="h-3 w-3" />
          Volver
        </button>
        <div className="h-3 w-px bg-border flex-shrink-0" />
        <p className="text-xs text-muted-foreground truncate min-w-0">
          <span>{session.clientName}</span>
          <span className="text-muted-foreground/60 mx-1.5">·</span>
          <span>{session.projectName}</span>
          <span className="text-muted-foreground/60 mx-1.5">·</span>
          <span className="text-foreground font-medium">{session.taskName}</span>
        </p>
        {(() => {
          const label = focusLabel(session, elapsed);
          if (!label) return null;
          const isBlocker = label === "Bloqueado";
          const isLow = label === "Foco bajo";
          return (
            <span className={`flex-shrink-0 text-[0.6rem] font-medium px-1.5 py-0.5 rounded border ${
              isBlocker
                ? "text-red-700 dark:text-red-400 border-red-500/20 bg-red-500/[0.06]"
                : isLow
                  ? "text-amber-700 dark:text-amber-400 border-amber-500/20 bg-amber-500/[0.04]"
                  : "text-cyan-500/80 border-cyan-500/20 bg-cyan-500/[0.04]"
            }`}>
              {label}
            </span>
          );
        })()}
      </div>
    </div>
  );
}
