import { CheckCircle2, FileEdit, Loader2, ShieldCheck } from "lucide-react";
import { getStationMeta } from "@/lib/pixelforge/station-meta";
import { cn } from "@/lib/utils";
import type { PixelforgeStation } from "@/lib/pixelforge/types";

interface Props {
  status: "draft" | "in_progress" | "completed" | "approved";
  currentStation: PixelforgeStation;
}

/** Badge de estado de un proyecto PixelForge (calco de DefinitionStatusBadge). */
export function PixelforgeStatusBadge({ status, currentStation }: Props) {
  if (status === "approved") {
    return (
      <span className="flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
        <ShieldCheck className="h-3 w-3" />
        Aprobado
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="flex items-center gap-1 rounded bg-lime-500/10 px-1.5 py-0.5 text-[11px] font-medium text-lime-700 dark:text-lime-300">
        <CheckCircle2 className="h-3 w-3" />
        Completada
      </span>
    );
  }
  if (status === "draft") {
    return (
      <span className="flex items-center gap-1 rounded bg-zinc-500/10 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
        <FileEdit className="h-3 w-3" />
        Borrador
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded bg-cyan-500/10 px-1.5 py-0.5 text-[11px] font-medium text-cyan-700 dark:text-cyan-300">
      <Loader2 className="h-3 w-3" />
      En progreso
      <span className={cn("ml-1 rounded px-1 py-0.5", "bg-muted text-muted-foreground")}>
        {getStationMeta(currentStation).stepLabel}
      </span>
    </span>
  );
}
