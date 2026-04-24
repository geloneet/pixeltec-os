import { Timestamp } from "firebase-admin/firestore";
import { db } from "../firebase-admin";
import type { LogEntry, LogSource, LogLevel } from "../logger";

const COLLECTION = "cryptoIntelLogs";

export interface LogFilter {
  source?: LogSource;
  level?: LogLevel;
  limit?: number;
}

export type LogEntrySerialized = Omit<LogEntry, "timestamp"> & { id: string; timestamp: string };

export async function listLogs(filter: LogFilter = {}): Promise<LogEntrySerialized[]> {
  const { source, level, limit = 100 } = filter;

  let query = db().collection(COLLECTION) as FirebaseFirestore.Query;
  if (source) query = query.where("source", "==", source);
  if (level) query = query.where("level", "==", level);

  const snap = await query.orderBy("timestamp", "desc").limit(limit).get().catch(async () => {
    return db().collection(COLLECTION).orderBy("timestamp", "desc").limit(limit).get();
  });

  return snap.docs.map(d => {
    const data = d.data() as LogEntry;
    const { timestamp, ...rest } = data;
    return { id: d.id, ...rest, timestamp: timestamp.toDate().toISOString() };
  });
}

export async function getMetrics(): Promise<{
  alertTriggered24h: number;
  priceErrors24h: number;
}> {
  const since24h = Timestamp.fromMillis(Date.now() - 86_400_000);

  const [alertsSnap, errorsSnap] = await Promise.all([
    db().collection("alerts")
      .where("createdAt", ">=", since24h)
      .get().catch(() => ({ size: 0 })),
    db().collection(COLLECTION)
      .where("level", "==", "error")
      .where("timestamp", ">=", since24h)
      .get().catch(() => ({ size: 0 })),
  ]);

  return {
    alertTriggered24h: alertsSnap.size,
    priceErrors24h: errorsSnap.size,
  };
}
