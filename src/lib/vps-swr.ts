import useSWR from "swr";
import type { VpsStatusResponse, VpsLogsResponse } from "./vps-types";

interface RawServerStats {
  diskTotal: string;
  diskUsed: string;
  diskFree: string;
  diskPercent: string | number;
  uptime: string;
  memTotal: string;
  memUsed: string;
  memFree: string;
}

interface RawStatusResponse {
  server: RawServerStats;
  projects: VpsStatusResponse["projects"];
}

function parsePercent(raw: string | number): number {
  if (typeof raw === "number") return raw;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

const statusFetcher = async (url: string): Promise<VpsStatusResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: res.statusText }))) as {
      error?: string;
    };
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const raw = (await res.json()) as RawStatusResponse;
  return {
    server: {
      ...raw.server,
      diskPercent: parsePercent(raw.server.diskPercent),
    },
    projects: raw.projects,
  };
};

const jsonFetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: res.statusText }))) as {
      error?: string;
    };
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
};

export function useVpsStatus() {
  return useSWR<VpsStatusResponse>("/api/vps/status", statusFetcher, {
    refreshInterval: 15000,
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  });
}

export function useVpsLogs(
  projectId: string | null,
  lines = 200,
  filter?: string
) {
  const params = new URLSearchParams();
  if (projectId) {
    params.set("project", projectId);
    params.set("lines", String(lines));
    if (filter) params.set("filter", filter);
  }
  const key = projectId ? `/api/vps/logs?${params.toString()}` : null;
  return useSWR<VpsLogsResponse>(key, jsonFetcher, {
    revalidateOnFocus: false,
    refreshInterval: 0,
  });
}
