import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/lib/vps-types";

const STYLES: Record<ProjectStatus, string> = {
  up: "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.6)] animate-pulse",
  paused: "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)]",
  down: "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]",
  unknown: "bg-zinc-500",
};

const LABELS: Record<ProjectStatus, string> = {
  up: "Activo",
  paused: "Pausado",
  down: "Caído",
  unknown: "Desconocido",
};

export function StatusDot({
  status,
  className,
  withLabel = false,
}: {
  status: ProjectStatus;
  className?: string;
  withLabel?: boolean;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-2", className)}
      aria-label={LABELS[status]}
    >
      <span className={cn("h-2.5 w-2.5 rounded-full", STYLES[status])} />
      {withLabel && (
        <span className="font-roboto text-xs uppercase tracking-wide text-zinc-400">
          {LABELS[status]}
        </span>
      )}
    </span>
  );
}
