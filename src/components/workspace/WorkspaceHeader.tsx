"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { WorkSession } from "@/types/session";
import type { CRMTask } from "@/types/crm";

interface Props {
  session: WorkSession;
  task: CRMTask;
  elapsed: number;
  onFinalize: () => void;
}

function productivityLabel(completedCount: number, elapsed: number): string {
  if (elapsed < 600) return ""; // less than 10 min — don't show yet
  if (completedCount === 0) return "Empezando";
  // Activities per hour ratio
  const hours = elapsed / 3600;
  const rate = completedCount / Math.max(hours, 0.25);
  if (rate >= 3) return "Productividad alta";
  if (rate >= 1.5) return "Productividad media";
  return "Ritmo pausado";
}

const PRIO_LABELS: Record<CRMTask["prio"], string> = {
  urgent_important: "Urgente e importante",
  important: "Alta",
  urgent: "Urgente",
  low: "Baja",
};

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatStartTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch {
    return iso;
  }
}

function SessionHealth({ session }: { session: WorkSession }) {
  const activeBlockers = session.blockers.filter(b => b.status === "active");
  const waitingBlockers = session.blockers.filter(b => b.status === "waiting");

  if (activeBlockers.length > 0) {
    return (
      <span className="text-[0.7rem] text-red-400">
        ● {activeBlockers.length} bloqueo{activeBlockers.length > 1 ? "s" : ""} activo{activeBlockers.length > 1 ? "s" : ""}
      </span>
    );
  }
  if (waitingBlockers.length > 0) {
    return (
      <span className="text-[0.7rem] text-amber-400">
        ● {waitingBlockers.length} esperando
      </span>
    );
  }
  return <span className="text-[0.7rem] text-zinc-500">● Sin bloqueos</span>;
}

export function WorkspaceHeader({ session, task, elapsed, onFinalize }: Props) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#0F0F12] px-6 py-3 min-h-[60px] max-h-[72px]">
      {/* Left: nav + breadcrumb */}
      <div className="flex flex-col gap-0.5 min-w-0 flex-1 mr-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push(`/proyectos/${session.projectId}?tab=tareas`)}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-3 w-3" />
            Volver
          </button>
          <div className="h-3 w-px bg-white/[0.08] flex-shrink-0" />
          <p className="text-xs text-zinc-400 truncate min-w-0">
            <span>{session.clientName}</span>
            <span className="text-zinc-700 mx-1.5">·</span>
            <span>{session.projectName}</span>
            <span className="text-zinc-700 mx-1.5">·</span>
            <span className="text-zinc-200 font-medium">{session.taskName}</span>
          </p>
        </div>
        <p className="text-[0.7rem] text-zinc-600 pl-[calc(0.75rem+0.25rem+12px)]">
          Trabajando desde las {formatStartTime(session.startedAt)}
          {task.prio !== "low" && (
            <span className="ml-2">· {PRIO_LABELS[task.prio]}</span>
          )}
        </p>
      </div>

      {/* Right: timer + status + action */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="flex flex-col items-end gap-0.5">
          <span className="font-mono text-[1.375rem] font-bold tabular-nums text-zinc-100 leading-none">
            {formatElapsed(elapsed)}
          </span>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[0.7rem] font-medium text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              Activa
            </span>
            <SessionHealth session={session} />
          </div>
          {/* Context line */}
          {(() => {
            const completedCount = session.activities.filter(a => !!a.completedAt).length;
            const label = productivityLabel(completedCount, elapsed);
            if (!label) return null;
            return (
              <p className="text-[0.65rem] text-zinc-600 tabular-nums">
                {completedCount > 0 && `${completedCount} actividad${completedCount !== 1 ? "es" : ""} · `}
                {label}
              </p>
            );
          })()}
        </div>
        <button
          onClick={onFinalize}
          className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-1.5 text-xs font-medium text-red-400 transition-all hover:bg-red-500/10 hover:border-red-500/30 flex-shrink-0"
        >
          Finalizar sesión
        </button>
      </div>
    </div>
  );
}
