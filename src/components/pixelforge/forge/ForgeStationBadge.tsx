import { CheckCircle2, FileEdit, Loader2, ShieldCheck } from "lucide-react";
import { getStationMeta } from "@/lib/pixelforge/station-meta";
import { cn } from "@/lib/utils";
import type { PixelforgeStation } from "@/lib/pixelforge/types";

interface Props {
  status: "draft" | "in_progress" | "completed" | "approved";
  currentStation: PixelforgeStation;
}

/** Clases comunes de la píldora — plancha diminuta con radio de forja. */
const BASE =
  "inline-flex items-center gap-1 rounded-[var(--pfx-radius)] px-1.5 py-0.5 text-[11px] font-medium";

/**
 * ForgeStationBadge — reskin del antiguo `PixelforgeStatusBadge` (borrado en
 * PF-X2 T0, sin consumidores tras la migración de X1 T4/T5) con materialidad
 * pfx. API y textos IDÉNTICOS al badge original (drop-in visual): mismos
 * cuatro estados y el chip de estación en `in_progress`. La materialidad sí
 * cambia al DNA de forja:
 *  - `in_progress` → cobre (`--pfx-accent`) con veta izquierda (calor activo).
 *  - `approved` / `completed` → acero sellado, frío (`--pfx-forge-sealed`).
 *  - `draft` → neutro (`--pfx-text-muted`).
 *  - el `stepLabel` va en mono (`font-forge-mono`), como metadata técnica.
 *
 * Server-safe.
 */
export function ForgeStationBadge({ status, currentStation }: Props) {
  if (status === "approved") {
    return (
      <span
        className={cn(
          BASE,
          "bg-[hsl(var(--pfx-forge-sealed)/0.12)] text-pfx-forge-sealed",
        )}
      >
        <ShieldCheck className="h-3 w-3" />
        Aprobado
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span
        className={cn(
          BASE,
          "bg-[hsl(var(--pfx-forge-sealed)/0.12)] text-pfx-forge-sealed",
        )}
      >
        <CheckCircle2 className="h-3 w-3" />
        Completada
      </span>
    );
  }
  if (status === "draft") {
    return (
      <span
        className={cn(
          BASE,
          "bg-[hsl(var(--pfx-border)/0.5)] text-pfx-text-muted",
        )}
      >
        <FileEdit className="h-3 w-3" />
        Borrador
      </span>
    );
  }
  return (
    <span
      className={cn(
        BASE,
        // Cobre + veta izquierda: la única fuente de calor (actividad).
        "border-l-2 border-pfx-accent bg-[hsl(var(--pfx-accent)/0.12)] text-pfx-accent",
      )}
    >
      <Loader2 className="h-3 w-3" />
      En progreso
      <span className="ml-1 rounded-[3px] bg-[hsl(var(--pfx-surface)/0.9)] px-1 py-0.5 font-forge-mono text-[10px] uppercase tracking-wider text-pfx-text-muted">
        {getStationMeta(currentStation).stepLabel}
      </span>
    </span>
  );
}
