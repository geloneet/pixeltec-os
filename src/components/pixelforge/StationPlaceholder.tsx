import { Clock } from "lucide-react";
import { getStationMeta } from "@/lib/pixelforge/station-meta";
import type { PixelforgeStation } from "@/lib/pixelforge/types";

interface Props {
  station: PixelforgeStation;
}

/**
 * Shell compartido de las 7 estaciones aún no construidas (todas menos
 * `contexto` en F1). Server-safe: sin hooks, sin "use client".
 */
export function StationPlaceholder({ station }: Props) {
  const meta = getStationMeta(station);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 text-center">
      <h1 className="text-xl font-semibold text-foreground">{meta.title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{meta.hint}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 rounded bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        Se habilita en la Fase {meta.phase}
      </span>
    </div>
  );
}
