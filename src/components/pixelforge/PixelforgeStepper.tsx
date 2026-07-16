"use client";

import Link from "next/link";
import { Check, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATION_META } from "@/lib/pixelforge/station-meta";
import type { PixelforgeArtifactStatus, PixelforgeStation } from "@/lib/pixelforge/types";

interface Props {
  projectId: string;
  /** Estado de cada estación por id (derivado de artifacts; producción/qa/revisión siempre "pending" en F1). */
  statuses: Record<PixelforgeStation, PixelforgeArtifactStatus>;
  /** Estación de la RUTA activa (no necesariamente currentStation del proyecto). */
  current: PixelforgeStation;
  /** Si el proceso completo está sellado. */
  completed?: boolean;
}

/**
 * Barra de progreso de estaciones de PixelForge — calco visual de
 * DefinitionStepper, con la diferencia de que cada paso es un link a la
 * ruta de esa estación (las estaciones de PixelForge son rutas navegables).
 */
export function PixelforgeStepper({ projectId, statuses, current, completed }: Props) {
  return (
    <div className="flex items-center justify-center gap-0">
      {STATION_META.map((step, i) => {
        const status = statuses[step.id];
        const active = !completed && step.id === current;
        const sealed = status === "sealed";
        const invalid = status === "invalidated";
        return (
          <div key={step.id} className="flex items-center">
            <Link
              href={`/proyectos/pixelforge/${projectId}/${step.id}`}
              className="flex flex-col items-center"
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-colors",
                  sealed
                    ? "border-cyan-500 bg-cyan-500 text-white"
                    : invalid
                      ? "border-amber-500 bg-background text-amber-400"
                      : active
                        ? "border-cyan-500 bg-background text-cyan-400"
                        : "border-border bg-background text-muted-foreground/60"
                )}
                title={step.title}
              >
                {sealed ? (
                  <Check className="h-4 w-4" />
                ) : invalid ? (
                  <RotateCcw className="h-3.5 w-3.5" />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={cn(
                  "mt-1 hidden text-[10px] sm:block",
                  active
                    ? "text-cyan-400"
                    : sealed
                      ? "text-muted-foreground"
                      : invalid
                        ? "text-amber-400"
                        : "text-muted-foreground/60"
                )}
              >
                {step.stepLabel}
              </span>
            </Link>
            {i < STATION_META.length - 1 && (
              <div
                className={cn(
                  "mb-4 h-px w-8 transition-colors sm:w-14",
                  statuses[STATION_META[i + 1].id] === "sealed" || sealed
                    ? "bg-cyan-500"
                    : "bg-secondary"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
