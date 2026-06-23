"use client";

import type { WorkSession } from "@/types/session";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  session: WorkSession;
  elapsed: number; // seconds
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatStartTime(isoString: string): string {
  try {
    return format(new Date(isoString), "h:mm a", { locale: es });
  } catch {
    return isoString;
  }
}

export function SessionTimer({ session, elapsed }: Props) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-5">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
        Ahora estás trabajando en
      </p>
      <div className="mb-4 space-y-0.5">
        <p className="text-xs text-zinc-500">
          <span className="text-zinc-400">Cliente:</span> {session.clientName}
        </p>
        <p className="text-xs text-zinc-500">
          <span className="text-zinc-400">Proyecto:</span> {session.projectName}
        </p>
        <p className="text-sm font-semibold text-zinc-200">{session.taskName}</p>
      </div>
      <div className="flex items-end gap-6">
        <div>
          <p className="text-[10px] text-zinc-600">Sesión iniciada</p>
          <p className="text-sm font-medium text-zinc-400">{formatStartTime(session.startedAt)}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-600">Tiempo trabajando</p>
          <p className="font-mono text-3xl font-bold tabular-nums text-zinc-100">
            {formatElapsed(elapsed)}
          </p>
        </div>
      </div>
    </div>
  );
}
