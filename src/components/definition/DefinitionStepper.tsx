"use client";

import { Check, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATION_META } from "@/lib/definition/station-meta";
import type { DefinitionStation } from "@/lib/definition/types";

export type StationStatus = "pending" | "in_progress" | "sealed" | "invalidated";

interface Props {
  /** Estado de cada estación por id. */
  statuses: Record<DefinitionStation, StationStatus>;
  /** Estación activa (resaltada). */
  current: DefinitionStation;
  /** Si el proceso completo está sellado. */
  completed?: boolean;
}

/**
 * Barra de progreso de estaciones — siempre visible. Adaptado de
 * WizardProgress (brand-brain): check = sellada, cyan = activa, ámbar =
 * invalidada por reapertura upstream.
 */
export function DefinitionStepper({ statuses, current, completed }: Props) {
  return (
    <div className="flex items-center justify-center gap-0">
      {STATION_META.map((step, i) => {
        const status = statuses[step.id];
        const active = !completed && step.id === current;
        const sealed = status === "sealed";
        const invalid = status === "invalidated";
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
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
            </div>
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
