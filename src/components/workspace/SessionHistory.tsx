"use client";

import { Clock, Activity, GitCommit, Rocket } from "lucide-react";
import type { WorkSession } from "@/types/session";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  sessions: WorkSession[];
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(iso: string): string {
  try {
    return format(new Date(iso), "d MMM yyyy · h:mm a", { locale: es });
  } catch {
    return "—";
  }
}

export function SessionHistory({ sessions }: Props) {
  const allCompleted = sessions
    .filter((s) => s.status === "completed")
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  const totalSeconds = allCompleted.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0);

  const completed = allCompleted.slice(0, 10);

  if (completed.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <Clock className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Sin sesiones de trabajo registradas</p>
        <p className="mt-1 text-xs text-muted-foreground/60">Las sesiones aparecerán aquí al finalizarlas</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Total hours summary */}
      <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-semibold text-foreground">{formatDuration(totalSeconds)}</span>
          <span className="text-xs text-muted-foreground">total trabajadas</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <span className="text-xs text-muted-foreground">{completed.length} sesión{completed.length !== 1 ? "es" : ""}</span>
      </div>

      {/* Sessions list */}
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {completed.map((session) => {
          const completedActivities = session.activities.filter((a) => a.completedAt).length;
          const openBlockerCount = session.blockers.filter((b) => b.status !== "resolved").length;
          return (
            <div key={session.id} className="px-4 py-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{session.taskName}</span>
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                  {session.durationSeconds ? formatDuration(session.durationSeconds) : "—"}
                </span>
              </div>
              <p className="mb-2 text-[11px] text-muted-foreground">{formatDate(session.startedAt)}</p>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60">
                <span className="flex items-center gap-1">
                  <Activity className="h-3 w-3" />
                  {completedActivities} actividad{completedActivities !== 1 ? "es" : ""}
                </span>
                {session.commitStatus && (
                  <span className="flex items-center gap-1 text-green-500">
                    <GitCommit className="h-3 w-3" />
                    Commit
                  </span>
                )}
                {session.deployStatus === "yes" && (
                  <span className="flex items-center gap-1 text-cyan-500">
                    <Rocket className="h-3 w-3" />
                    Deploy
                  </span>
                )}
                {openBlockerCount > 0 && (
                  <span className="text-red-500">
                    {openBlockerCount} bloqueo{openBlockerCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
