import { db, COL } from "../firebase-admin";
import type { AlertRule, AlertEvent } from "../types";

export type AlertRuleWithId = AlertRule & { id: string };
export type AlertEventWithId = AlertEvent & { id: string };

export async function listAlerts(includeDeleted = false): Promise<AlertRuleWithId[]> {
  let query = db().collection(COL.alertRules) as FirebaseFirestore.Query;
  if (!includeDeleted) {
    query = query.where("deletedAt", "==", null);
  }
  const snap = await query.orderBy("createdAt", "desc").get().catch(async () => {
    // fallback without orderBy if index missing
    return db().collection(COL.alertRules).where("active", "!=", null).get();
  });

  return snap.docs
    .map(d => ({ id: d.id, ...(d.data() as AlertRule) }))
    .filter(a => includeDeleted || !a.deletedAt);
}

export async function getAlert(id: string): Promise<AlertRuleWithId | null> {
  const doc = await db().collection(COL.alertRules).doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...(doc.data() as AlertRule) };
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
