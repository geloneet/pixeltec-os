"use client";

import useSWR from "swr";
import type { PixelforgeQaRun, PixelforgeQaFinding } from "@/lib/db/schema";

export interface PixelforgeQaRunWithFindings {
  run: PixelforgeQaRun;
  findings: PixelforgeQaFinding[];
}

const TERMINAL_STATUSES = new Set<PixelforgeQaRun["status"]>(["succeeded", "failed"]);

/**
 * Lanza si `!res.ok` (con el status en el mensaje, en español) — mismo
 * criterio que `usePixelforgeRun` (`use-pixelforge-run.ts`): de lo contrario
 * SWR guardaría un body de error como si fuera el estado del QA y el
 * `refreshInterval` de abajo (que solo se apaga mirando `data.run.status`)
 * pollearía para siempre sobre un fetch que nunca tiene ese campo.
 */
async function fetcher(url: string): Promise<PixelforgeQaRunWithFindings> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`No se pudo obtener el estado del QA (HTTP ${res.status}).`);
  }
  return res.json();
}

/** Calco de `usePixelforgeRun` (`use-pixelforge-run.ts`) adaptado al shape de `GET /api/pixelforge/qa/runs/:qaRunId` (F8-T4: run + findings). */
export function usePixelforgeQaRun(qaRunId: string | null) {
  const isActive = !!qaRunId;

  const { data, error } = useSWR<PixelforgeQaRunWithFindings>(
    isActive ? `/api/pixelforge/qa/runs/${qaRunId}` : null,
    fetcher,
    {
      refreshInterval: (data) => {
        if (!data) return 2000;
        if (TERMINAL_STATUSES.has(data.run.status)) return 0;
        return 2000;
      },
      revalidateOnFocus: false,
    }
  );

  return {
    run: data?.run ?? null,
    findings: data?.findings ?? [],
    isLoading: isActive && !data && !error,
    error,
  };
}
