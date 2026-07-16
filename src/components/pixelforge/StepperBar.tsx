"use client";

import { usePathname } from "next/navigation";
import { PixelforgeStepper } from "@/components/pixelforge/PixelforgeStepper";
import { isValidStation, type PixelforgeArtifactStatus, type PixelforgeStation } from "@/lib/pixelforge/types";

interface Props {
  projectId: string;
  statuses: Record<PixelforgeStation, PixelforgeArtifactStatus>;
  /** Estación a usar si la ruta actual no termina en un segmento de estación válido. */
  fallbackStation: PixelforgeStation;
  completed?: boolean;
}

/**
 * Puente cliente entre el layout server de `[id]` y `PixelforgeStepper`: el
 * layout no recibe el pathname por props (Next 15), así que este componente
 * lee `usePathname()`, toma el último segmento de la ruta y lo valida como
 * estación — si no es válida (p.ej. estamos en `[id]/page.tsx` antes del
 * redirect) cae a `fallbackStation`.
 */
export function StepperBar({ projectId, statuses, fallbackStation, completed }: Props) {
  const pathname = usePathname();
  const lastSegment = pathname.split("/").filter(Boolean).pop() ?? "";
  const current = isValidStation(lastSegment) ? lastSegment : fallbackStation;

  return (
    <PixelforgeStepper
      projectId={projectId}
      statuses={statuses}
      current={current}
      completed={completed}
    />
  );
}
