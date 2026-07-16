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

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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
