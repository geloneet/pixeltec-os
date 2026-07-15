import { CheckCircle2, FileEdit } from "lucide-react";
import { getStationMeta } from "@/lib/definition/station-meta";
import { cn } from "@/lib/utils";
import type { DefinitionStation } from "@/lib/definition/types";

interface Props {
  status: "draft" | "in_progress" | "completed";
  currentStation: DefinitionStation;
}

/** Badge de estado de una definición: Completo / Borrador / estación actual. */
export function DefinitionStatusBadge({ status, currentStation }: Props) {
  if (status === "completed") {
    return (
      <span className="flex items-center gap-1 rounded bg-cyan-500/10 px-1.5 py-0.5 text-[11px] font-medium text-cyan-700 dark:text-cyan-300">
        <CheckCircle2 className="h-3 w-3" />
        Completo
      </span>
    );
  }
  if (status === "draft") {
    return (
      <span className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
        <FileEdit className="h-3 w-3" />
        Borrador
      </span>
    );
  }
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", "bg-muted text-muted-foreground")}>
      {getStationMeta(currentStation).stepLabel}
    </span>
  );
}
