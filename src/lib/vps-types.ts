export type ProjectType = "docker" | "docker-compose" | "pm2" | "manual";
export type ProjectStatus = "up" | "paused" | "down" | "unknown";

export interface VpsServerStats {
  diskTotal: string;
  diskUsed: string;
  diskFree: string;
  diskPercent: number;
  uptime: string;
  memTotal: string;
  memUsed: string;
  memFree: string;
}

export interface VpsProject {
  id: string;
  name: string;
  type: ProjectType;
  domain: string | null;
  description: string;
  status: string;
  active: boolean;
  size: string;
  containerName: string | null;
  pm2Name: string | null;
}

export interface VpsStatusResponse {
  server: VpsServerStats;
  projects: VpsProject[];
}

export function parseStatus(raw: string, active: boolean): ProjectStatus {
  if (!active) return "paused";
  if (/^up\s/i.test(raw) || raw === "online") return "up";
  if (/paused/i.test(raw)) return "paused";
  if (!raw || raw === "unknown") return "unknown";
  return "down";
}

export type VpsAction = "deploy" | "restart" | "pause" | "resume";

export interface VpsActionResponse {
  success: boolean;
  message?: string;
  error?: string;
  output?: string;
}

export interface VpsLogsResponse {
  logs: string;
  project?: string;
  lines?: number;
}

// ── Health snapshot / audit / backup (dashboard rebuild) ──────────────────────

export interface VpsSnapshot {
  generatedAt: string;
  disk: { size: string; used: string; avail: string; usedPct: number };
  host: {
    ramUsedPct: number;
    load1: number;
    nproc: number;
    crashLoops: { name: string; restarts: number }[];
  };
  services: {
    id: string;
    name: string;
    domain: string | null;
    status: string;
    httpOk: boolean | null;
    httpCode: number | null;
  }[];
  certs: { domain: string; expiresAt: string; daysLeft: number }[];
  databases: { name: string; size: string; lastBackupAgeHrs: number | null }[];
  backups: {
    ok: boolean;
    lastRunAgeHrs: number | null;
    coverageMissing: string[];
    offsite: boolean;
  };
  security: {
    securityUpdates: number;
    publicPortsOutOfPolicy: number[];
    sshPassword: boolean;
    secretsInLogs: string[];
  };
}

export type VpsSymptomSeverity = "red" | "yellow" | "green";

export interface VpsSymptom {
  id: string;
  severity: VpsSymptomSeverity;
  area: string;
  message: string;
  suggestedAction: string;
  evidence: unknown;
}

export interface VpsAuditReport {
  symptoms: VpsSymptom[];
  summary: { red: number; yellow: number; green: number };
  generatedAt: string;
}

export interface VpsBackupResult {
  ok: boolean;
  durationMs: number;
  tail: string;
}
