import { Lock } from "lucide-react";
import { getStationMeta } from "@/lib/pixelforge/station-meta";
import type { PixelforgeStation } from "@/lib/pixelforge/types";

interface Props {
  station: PixelforgeStation;
}

/**
 * Shell compartido de las estaciones aún no construidas. Materialidad
 * `locked` (docs/pixelforge/product-dna.md § Estados canónicos): una estación
 * futura es "aún no forjable" — misma firma visual que un segmento bloqueado
 * del riel de forja: contorno punteado en `--pfx-forge-locked` y el dato de
 * fase en mono (`font-forge-mono`), como metadata técnica. Server-safe: sin
 * hooks, sin "use client".
 */
export function StationPlaceholder({ station }: Props) {
  const meta = getStationMeta(station);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 text-center">
      <h1 className="text-xl font-semibold text-pfx-text">{meta.title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-pfx-text-muted">{meta.hint}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 rounded-[var(--pfx-radius)] border border-dashed border-pfx-forge-locked px-2.5 py-1 font-forge-mono text-[11px] uppercase tracking-wide text-pfx-text-muted">
        <Lock className="h-3.5 w-3.5 text-pfx-forge-locked" />
        Se habilita en la Fase {meta.phase}
      </span>
    </div>
  );
}
