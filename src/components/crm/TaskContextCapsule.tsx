"use client";

import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import type { CRMTask } from "@/types/crm";
import type { WorkSession } from "@/types/session";
import { cn } from "@/lib/utils";

interface Props {
  task: CRMTask;
  sessions: WorkSession[];
  className?: string;
}

function fmtDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function relativeTime(isoDate: string): string {
  try {
    return formatDistanceToNow(new Date(isoDate), { locale: es, addSuffix: true });
  } catch {
    return "—";
  }
}

export function TaskContextCapsule({ task, sessions, className }: Props) {
  const taskSessions = sessions.filter((s) => s.taskId === task.id);
  const activeSession = taskSessions.find((s) => s.status === "active");
  const completedSessions = taskSessions.filter((s) => s.status === "completed");
  const totalSeconds = completedSessions.reduce((acc, s) => acc + (s.durationSeconds ?? 0), 0);
  const lastSession = completedSessions
    .slice()
    .sort((a, b) => new Date(b.endedAt ?? b.startedAt).getTime() - new Date(a.endedAt ?? a.startedAt).getTime())[0];

  // Active session: always highest priority
  if (activeSession) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-[11px] text-green-400", className)}>
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
        </span>
        Trabajando ahora
      </span>
    );
  }

  if (task.status === "completado") {
    return (
      <span className={cn("text-[11px] text-zinc-500", className)}>
        {totalSeconds > 0 ? `Finalizada · ${fmtDuration(totalSeconds)} invertidas` : "Finalizada"}
      </span>
    );
  }

  if (task.status === "bloqueado") {
    return (
      <span className={cn("text-[11px] text-red-400/80", className)}>
        Bloqueada
      </span>
    );
  }

  if (task.status === "en_revision") {
    return (
      <span className={cn("text-[11px] text-blue-400/80", className)}>
        Lista para revisión
      </span>
    );
  }

  if (task.status === "pausado") {
    return (
      <span className={cn("text-[11px] text-zinc-500", className)}>
        {lastSession
          ? `Pausada · última sesión ${relativeTime(lastSession.endedAt ?? lastSession.startedAt)}`
          : "Pausada"}
      </span>
    );
  }

  // pendiente / en_progreso — mostrar contexto de retoma
  if (lastSession) {
    return (
      <span className={cn("text-[11px] text-amber-400/80", className)}>
        Retomar · última sesión {relativeTime(lastSession.endedAt ?? lastSession.startedAt)}
      </span>
    );
  }

  return (
    <span className={cn("text-[11px] text-zinc-600", className)}>
      Sin iniciar
    </span>
  );
}
