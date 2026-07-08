import { createLog } from "@/lib/db/repos/crypto-intel";

export type LogLevel = "info" | "warn" | "error";
export type LogSource = "price-sync" | "alert-engine" | "telegram-webhook" | "admin";

export interface LogEntry {
  id?: string;
  timestamp: Date;
  source: LogSource;
  level: LogLevel;
  message: string;
  metadata: Record<string, unknown>;
}

export async function log(
  source: LogSource,
  level: LogLevel,
  message: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    await createLog({
      source,
      level,
      message,
      metadata,
    });
  } catch {
    // Never let logging crash the caller
    console.error("[logger] failed to write log", { source, level, message });
  }
}
