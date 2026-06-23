"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { SessionActivity } from "@/types/session";

interface Props {
  activities: SessionActivity[];
}

function formatTime(iso: string): string {
  try {
    return format(new Date(iso), "HH:mm", { locale: es });
  } catch {
    return "—";
  }
}

export function ActivityTimeline({ activities }: Props) {
  const completed = activities.filter(a => a.completedAt);

  if (completed.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
        <p className="mb-2 text-xs font-semibold text-zinc-400">Historial de actividades</p>
        <p className="text-center py-4 text-xs text-zinc-600">
          Aún no hay actividades completadas en esta sesión
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
      <p className="mb-3 text-xs font-semibold text-zinc-400">
        Historial de actividades ({completed.length})
      </p>
      <div className="relative space-y-0">
        {completed.map((activity, i) => (
          <div key={activity.id} className="flex gap-3">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div className="h-2 w-2 flex-shrink-0 rounded-full bg-cyan-500 mt-1" />
              {i < completed.length - 1 && (
                <div className="w-px flex-1 bg-white/[0.06] mt-1" style={{ minHeight: "20px" }} />
              )}
            </div>
            <div className="pb-3 min-w-0">
              <p className="text-[10px] tabular-nums text-zinc-600">{formatTime(activity.startedAt)}</p>
              <p className="text-sm text-zinc-300">{activity.description || "Sin descripción"}</p>
              {activity.completedAt && (
                <p className="text-[10px] text-zinc-600">
                  → {formatTime(activity.completedAt)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
