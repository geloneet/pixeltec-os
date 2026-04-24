import { db, COL } from "../firebase-admin";
import type { AlertRule, AlertEvent } from "../types";
import type { Timestamp } from "firebase-admin/firestore";

export type AlertRuleWithId = AlertRule & { id: string };
export type AlertEventWithId = AlertEvent & { id: string };

// Serialized variants safe for Server→Client Component boundaries
export type AlertRuleSerialized = Omit<AlertRuleWithId, "createdAt" | "updatedAt" | "deletedAt" | "lastTriggeredAt"> & {
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
  lastTriggeredAt?: string;
};

function tsToIso(ts: Timestamp): string {
  return ts.toDate().toISOString();
}

function serializeAlert(id: string, data: AlertRule): AlertRuleSerialized {
  const { createdAt, updatedAt, deletedAt, lastTriggeredAt, ...rest } = data;
  return {
    id,
    ...rest,
    createdAt: tsToIso(createdAt),
    ...(updatedAt !== undefined ? { updatedAt: tsToIso(updatedAt) } : {}),
    ...(deletedAt !== undefined ? { deletedAt: deletedAt ? tsToIso(deletedAt) : null } : {}),
    ...(lastTriggeredAt !== undefined ? { lastTriggeredAt: tsToIso(lastTriggeredAt) } : {}),
  };
}

export async function listAlerts(includeDeleted = false): Promise<AlertRuleSerialized[]> {
  let query = db().collection(COL.alertRules) as FirebaseFirestore.Query;
  if (!includeDeleted) {
    query = query.where("deletedAt", "==", null);
  }
  const snap = await query.orderBy("createdAt", "desc").get().catch(async () => {
    // Fallback when composite index is not yet deployed — omit deletedAt filter
    return db().collection(COL.alertRules).where("active", "==", true).orderBy("createdAt", "desc").get();
  });

  return snap.docs
    .map(d => serializeAlert(d.id, d.data() as AlertRule))
    .filter(a => includeDeleted || !a.deletedAt);
}

export async function getAlert(id: string): Promise<AlertRuleSerialized | null> {
  const doc = await db().collection(COL.alertRules).doc(id).get();
  if (!doc.exists) return null;
  return serializeAlert(doc.id, doc.data() as AlertRule);
}

export async function getAlertHistory(alertId: string): Promise<AlertEventWithId[]> {
  const snap = await db()
    .collection(COL.alerts)
    .where("ruleId", "==", alertId)
    .get();
  return snap.docs
    .map(d => ({ id: d.id, ...(d.data() as AlertEvent) }))
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
    .slice(0, 50);
}
