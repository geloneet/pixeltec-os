"use client";

import useSWR from "swr";

export type PixelforgeRunStatus = "queued" | "running" | "succeeded" | "failed";

export interface PixelforgeRunState {
  id: string;
  projectId: string;
  operation: string;
  status: PixelforgeRunStatus;
  progress: number;
  currentStep: string | null;
  error: string | null;
  resultRef: string | null;
}

/**
 * Lanza si `!res.ok` (con el status en el mensaje, en español) para que SWR
 * registre el error en `error` en vez de tragarse un body de error como si
 * fuera el estado de la corrida — de lo contrario `data` queda con forma
 * inesperada (p.ej. `{ ok: false, error: "..." }` en vez de `PixelforgeRunState`)
 * y el `refreshInterval` de abajo, que solo se apaga mirando
 * `data?.status`, sigue polleando para siempre sobre un fetch que nunca
 * va a tener ese campo.
 */
async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`No se pudo obtener el estado de la corrida (HTTP ${res.status}).`);
  }
  return res.json();
}

/** Clon de `src/hooks/growth/use-generation-job.ts` adaptado al shape público de `getRunForOwner` (F2-T4). */
export function usePixelforgeRun(runId: string | null) {
  const isActive = !!runId;

  const { data, error } = useSWR<PixelforgeRunState>(
    isActive ? `/api/pixelforge/runs/${runId}` : null,
    fetcher,
    {
      refreshInterval: (data) => {
        if (!data) return 2000;
        if (data.status === "succeeded" || data.status === "failed") return 0;
        return 2000;
      },
      revalidateOnFocus: false,
    }
  );

  const isPolling = isActive && data?.status !== "succeeded" && data?.status !== "failed";

  return {
    run: data ?? null,
    isPolling,
    error,
  };
}
