import { countAlertEventsSince, countErrorLogsSince, listLogs as repoListLogs } from "@/lib/db/repos/crypto-intel";
import type { LogEntry, LogSource, LogLevel } from "../logger";

export interface LogFilter {
  source?: LogSource;
  level?: LogLevel;
  limit?: number;
}

export type LogEntrySerialized = Omit<LogEntry, "timestamp"> & { id: string; timestamp: string };

export async function listLogs(filter: LogFilter = {}): Promise<LogEntrySerialized[]> {
  const rows = await repoListLogs(filter);
  return rows.map((r) => ({
    id: r.id,
    source: r.source,
    level: r.level,
    message: r.message,
    metadata: r.metadata as Record<string, unknown>,
    timestamp: r.timestamp.toISOString(),
  }));
}

export async function getMetrics(): Promise<{
  alertTriggered24h: number;
  priceErrors24h: number;
}> {
  const since24h = new Date(Date.now() - 86_400_000);

  const [alertTriggered24h, priceErrors24h] = await Promise.all([
    countAlertEventsSince(since24h),
    countErrorLogsSince(since24h),
  ]);

  return { alertTriggered24h, priceErrors24h };
}
