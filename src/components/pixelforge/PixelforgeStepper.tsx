"use client";

import Link from "next/link";
import { Check, Lock, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATION_META, type StationMeta } from "@/lib/pixelforge/station-meta";
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

/** Materialidad canónica de un segmento del riel (docs/pixelforge/product-dna.md § Stepper). */
type RailState = "locked" | "active" | "sealed" | "invalidated";

function railState(
  step: StationMeta,
  statuses: Props["statuses"],
  current: PixelforgeStation,
  completed: boolean
): RailState {
  const status = statuses[step.id];
  if (status === "sealed") return "sealed";
  if (status === "invalidated") return "invalidated";
  if (!completed && step.id === current) return "active";
  return "locked";
}

const SEGMENT_BASE =
  "flex h-7 w-7 items-center justify-center rounded-[4px] text-xs font-bold transition-colors";

const SEGMENT_BY_STATE: Record<RailState, string> = {
  sealed: "bg-pfx-forge-sealed text-pfx-canvas",
  invalidated: "border border-dashed border-pfx-warning bg-pfx-surface text-pfx-warning",
  // Segmento caliente: relleno cobre + glow estático (excepción documentada del
  // DNA para el riel — no es decorativo permanente, señala la posición actual).
  active:
    "bg-pfx-accent text-pfx-on-accent shadow-[0_0_0_1px_hsl(var(--pfx-accent)/0.35),0_0_14px_-3px_hsl(var(--pfx-glow)/0.55)]",
  locked: "border border-dashed border-pfx-forge-locked bg-transparent text-pfx-text-muted",
};

const LABEL_BY_STATE: Record<RailState, string> = {
  sealed: "text-pfx-forge-sealed",
  invalidated: "text-pfx-warning",
  active: "text-pfx-accent",
  locked: "text-pfx-text-muted",
};

const CONNECTOR_BY_STATE: Record<RailState, string> = {
  // El riel se solidifica con el avance: acero detrás de lo sellado, cobre en
  // el tramo que se está forjando ahora mismo, veta en reposo en el resto.
  sealed: "bg-pfx-forge-sealed",
  active: "bg-pfx-accent",
  invalidated: "bg-pfx-seam",
  locked: "bg-pfx-seam",
};

/**
 * PixelforgeStepper — "riel de forja" (PF-X1 T5, docs/pixelforge/product-dna.md § Stepper).
 *
 * Deja de ser círculos numerados: cada estación es un segmento de material en
 * un riel continuo (la veta) que se solidifica con el avance —
 *  - sealed: segmento sólido acero + check grabado.
 *  - active: segmento caliente (cobre + glow estático), label siempre
 *    visible, `aria-current="step"`.
 *  - invalidated: segmento con fisura ámbar (contorno discontinuo) + RotateCcw.
 *  - locked: segmento hueco punteado (aún no alcanzado).
 * Todo par texto/fondo usa tokens `--pfx-*` a su intensidad plena (sin
 * opacidad recortada) para sostener AA en los cuatro estados — el stepper
 * anterior fallaba AA apoyándose en `text-muted-foreground/60`.
 *
 * Cada estación sigue siendo un `Link` a su ruta (las estaciones son
 * navegables); el layout que monta esto (`StepperBar`) preserva el sticky.
 * Desktop: label mono bajo cada segmento. Móvil: solo segmentos + nombre de
 * la estación actual bajo el riel completo.
 */
export function PixelforgeStepper({ projectId, statuses, current, completed = false }: Props) {
  const currentMeta = STATION_META.find((s) => s.id === current);

  return (
    <nav aria-label="Progreso de la forja">
      <ol className="flex items-center justify-center gap-0">
        {STATION_META.map((step, i) => {
          const state = railState(step, statuses, current, completed);
          return (
            <li key={step.id} className="flex items-center">
              <Link
                href={`/proyectos/pixelforge/${projectId}/${step.id}`}
                data-state={state}
                aria-current={state === "active" ? "step" : undefined}
                className="flex flex-col items-center"
              >
                <span className={cn(SEGMENT_BASE, SEGMENT_BY_STATE[state])} title={step.title}>
                  {state === "sealed" ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : state === "invalidated" ? (
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : state === "locked" ? (
                    <Lock className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={cn(
                    "mt-1 hidden font-forge-mono text-[10px] uppercase tracking-wider sm:block",
                    LABEL_BY_STATE[state]
                  )}
                >
                  {step.stepLabel}
                </span>
              </Link>
              {i < STATION_META.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "mb-4 h-0.5 w-8 rounded-full transition-colors sm:w-14",
                    CONNECTOR_BY_STATE[state]
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
      {currentMeta && (
        <p className="mt-2 text-center font-forge-mono text-[10px] uppercase tracking-wider text-pfx-text-muted sm:hidden">
          {currentMeta.stepLabel}
        </p>
      )}
    </nav>
  );
}
