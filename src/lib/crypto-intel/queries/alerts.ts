import { getAlertHistory as repoGetAlertHistory, getAlertRuleById, listAlertRulesByUser } from "@/lib/db/repos/crypto-intel";
import { db } from "@/lib/db";
import { cryptoAlertRules } from "@/lib/db/schema";
import { desc, isNull } from "drizzle-orm";
import type { AlertRule, AlertEvent } from "../types";

export type AlertRuleWithId = AlertRule & { id: string };
export type AlertEventWithId = AlertEvent & { id: string };

// Serialized variants safe for Server→Client Component boundaries
export type AlertRuleSerialized = Omit<AlertRuleWithId, "createdAt" | "updatedAt" | "deletedAt" | "lastTriggeredAt"> & {
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
  lastTriggeredAt?: string;
};

function dateToIso(d: Date): string {
  return d.toISOString();
}

function serializeAlert(row: typeof cryptoAlertRules.$inferSelect): AlertRuleSerialized {
  return {
    id: row.id,
    userId: row.userId,
    symbol: row.symbol,
    type: row.type,
    params: row.params as AlertRule["params"],
    channels: row.channels as AlertRule["channels"],
    cooldownMinutes: row.cooldownMinutes,
    active: row.active,
    telegramChatId: row.telegramChatId ?? undefined,
    displayName: row.displayName ?? undefined,
    triggerCount: row.triggerCount,
    createdAt: dateToIso(row.createdAt),
    updatedAt: dateToIso(row.updatedAt),
    deletedAt: row.deletedAt ? dateToIso(row.deletedAt) : null,
    ...(row.lastTriggeredAt ? { lastTriggeredAt: dateToIso(row.lastTriggeredAt) } : {}),
  };
}

export async function listAlerts(includeDeleted = false): Promise<AlertRuleSerialized[]> {
  const query = db.select().from(cryptoAlertRules);
  const rows = includeDeleted
    ? await query.orderBy(desc(cryptoAlertRules.createdAt))
    : await query.where(isNull(cryptoAlertRules.deletedAt)).orderBy(desc(cryptoAlertRules.createdAt));

  return rows.map(serializeAlert).filter((a) => includeDeleted || !a.deletedAt);
}

export async function getAlert(id: string): Promise<AlertRuleSerialized | null> {
  const row = await getAlertRuleById(id);
  if (!row) return null;
  return serializeAlert(row);
}

export async function getAlertHistory(alertId: string): Promise<AlertEventWithId[]> {
  const rows = await repoGetAlertHistory(alertId, 50);
  return rows.map((r) => ({
    id: r.id,
    ruleId: r.ruleId,
    userId: r.userId,
    symbol: r.symbol,
    message: r.message,
    payload: r.payload as Record<string, unknown>,
    deliveredTo: r.deliveredTo as string[],
    createdAt: r.createdAt,
  }));
}
