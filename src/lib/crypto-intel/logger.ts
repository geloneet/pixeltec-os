import { Timestamp } from "firebase-admin/firestore";
import { db } from "./firebase-admin";

export type LogLevel = "info" | "warn" | "error";
export type LogSource = "price-sync" | "alert-engine" | "telegram-webhook" | "admin";

export interface LogEntry {
  id?: string;
  timestamp: Timestamp;
  source: LogSource;
  level: LogLevel;
  message: string;
  metadata: Record<string, unknown>;
}

const COLLECTION = "cryptoIntelLogs";

export async function log(
  source: LogSource,
  level: LogLevel,
  message: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    await db().collection(COLLECTION).add({
      timestamp: Timestamp.now(),
      source,
      level,
      message,
      metadata,
    } satisfies Omit<LogEntry, "id">);
  } catch {
    // Never let logging crash the caller
    console.error("[logger] failed to write log", { source, level, message });
  }
}
