"use client";

import { useMemo } from "react";
import { TaskStatusDropdown } from "./TaskStatusDropdown";
import { TaskContextCapsule } from "./TaskContextCapsule";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PRIORITIES } from "@/types/crm";
import type { CRMTask } from "@/types/crm";
import type { WorkSession } from "@/types/session";
import { cn } from "@/lib/utils";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

interface ProjectTaskCardProps {
  task: CRMTask;
  clientId: string;
  projectId: string;
  sessions: WorkSession[];
  onUpdateStatus: (s: CRMTask["status"]) => void;
  onStartSession: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function fmtDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return "<1m";
}

export function ProjectTaskCard({
  task,
  sessions,
  onUpdateStatus,
  onStartSession,
  onEdit,
  onDelete,
}: ProjectTaskCardProps) {
  const taskSessions = useMemo(
    () => sessions.filter((s) => s.taskId === task.id),
    [sessions, task.id]
  );
  const activeSession = taskSessions.find((s) => s.status === "active");
  const completedSessions = taskSessions.filter((s) => s.status === "completed");
  const totalSeconds = completedSessions.reduce((acc, s) => acc + (s.durationSeconds ?? 0), 0);

  const isCompleted = task.status === "completado";
  const isBlocked = task.status === "bloqueado";
  const isReview = task.status === "en_revision";
  const hideCTA = isCompleted || isBlocked || isReview;

  const ctaLabel = activeSession
    ? "Abrir sesión →"
    : task.status === "en_progreso"
    ? "▶ Continuar"
    : task.status === "pausado"
    ? "▶ Reanudar"
    : "▶ Iniciar sesión";

  const statsLine = [
    completedSessions.length > 0 && `${completedSessions.length} sesión${completedSessions.length !== 1 ? "es" : ""}`,
    totalSeconds > 0 && fmtDuration(totalSeconds),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={cn(
        "group rounded-xl border border-border bg-card px-4 py-3.5 transition-all hover:bg-secondary/40",
        isCompleted && "opacity-40"
      )}
    >
      {/* Row 1: priority dot + name + ⋮ menu */}
      <div className="flex items-start gap-2.5">
        <span
          className="mt-1 h-2 w-2 flex-shrink-0 rounded-full"
          style={{ backgroundColor: PRIORITIES[task.prio].color }}
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-sm font-medium text-foreground leading-snug",
              isCompleted && "line-through"
            )}
          >
            {task.name}
          </p>
          {task.desc && (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{task.desc}</p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-secondary hover:text-foreground group-hover:opacity-100">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-36 p-1 text-xs"
          >
            <DropdownMenuItem
              onClick={onEdit}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Pencil className="h-3 w-3" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem
              onClick={onDelete}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-red-400/80 transition-colors hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 className="h-3 w-3" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Row 2: capsule + stats */}
      <div className="mt-2 flex items-center gap-3 pl-[18px]">
        <TaskContextCapsule task={task} sessions={sessions} />
        {statsLine && (
          <span className="text-[10px] text-muted-foreground/60">{statsLine}</span>
        )}
      </div>

      {/* Row 3: status chip + CTA */}
      <div className="mt-3 flex items-center justify-between pl-[18px]">
        <TaskStatusDropdown status={task.status} onChange={onUpdateStatus} />
        {(!hideCTA || !!activeSession) && (
          <button
            onClick={onStartSession}
            className={cn(
              "rounded-lg border px-3 py-1 text-[11px] font-medium transition-all hover:brightness-110 whitespace-nowrap",
              activeSession
                ? "border-green-500/20 bg-green-500/10 text-green-400"
                : "border-cyan-500/20 bg-cyan-500/[0.08] text-cyan-400 hover:bg-cyan-500/20"
            )}
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}
