import useSWR from "swr";
import type {
  VpsStatusResponse,
  VpsLogsResponse,
  VpsSnapshot,
  VpsAuditReport,
  VpsBackupResult,
} from "./vps-types";

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
    const e = new Error(err.error || `HTTP ${res.status}`) as Error & { status: number };
    e.status = res.status;
    throw e;
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

export function useVpsSnapshot() {
  return useSWR<VpsSnapshot>("/api/vps/snapshot", jsonFetcher, {
    refreshInterval: 15000,
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  });
}

/**
 * La auditoría es cara de correr en el backend (revisa disco, certs, backups,
 * seguridad, etc.) — se dispara manualmente desde un botón, no por polling.
 * `revalidateOnMount: false` evita el fetch automático al montar; el caller
 * dispara la primera corrida llamando a `mutate()`.
 */
export function useVpsAudit() {
  return useSWR<VpsAuditReport>("/api/vps/audit", jsonFetcher, {
    revalidateOnMount: false,
    revalidateOnFocus: false,
    refreshInterval: 0,
  });
}

/** Helper de fetch directo para disparar la auditoría fuera de un componente (p.ej. desde un handler). */
export function runVpsAudit(): Promise<VpsAuditReport> {
  return jsonFetcher<VpsAuditReport>("/api/vps/audit");
}

export async function runVpsBackup(): Promise<VpsBackupResult> {
  const res = await fetch("/api/vps/backup", { method: "POST" });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: res.statusText }))) as {
      error?: string;
    };
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as VpsBackupResult;
}
