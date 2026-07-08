/**
 * Repo de Crypto-Intel — Postgres/Drizzle. Ver src/lib/db/schema.ts.
 *
 * Sustituye a src/lib/crypto-intel/firebase-admin.ts (Firestore). Ver
 * docs/superpowers/plans/2026-07-07-firebase-to-postgres-drizzle-nextauth-migration.md.
 *
 * `userId` en cryptoAlertRules/cryptoAlertEvents es un string crudo sin FK
 * (polimórfico: Firebase UID desde el dashboard, ID de Telegram desde el
 * bot) — no normalizar, ver nota en schema.ts.
 */
import { and, asc, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  cryptoAlertEvents,
  cryptoAlertRules,
  cryptoIntelLogs,
  cryptoPricePoints,
  cryptoPrices,
  cryptoTelegramUsers,
  type NewCryptoAlertEvent,
  type NewCryptoAlertRule,
  type NewCryptoIntelLog,
  type NewCryptoPrice,
  type NewCryptoPricePoint,
  type NewCryptoTelegramUser,
} from "@/lib/db/schema";

// ── Prices ──────────────────────────────────────────────────────────────

export function getLatestPrice(symbol: string) {
  return db
    .select()
    .from(cryptoPrices)
    .where(eq(cryptoPrices.symbol, symbol.toUpperCase()))
    .then((rows) => rows[0] ?? null);
}

export function upsertPrice(snapshot: NewCryptoPrice) {
  return db
    .insert(cryptoPrices)
    .values(snapshot)
    .onConflictDoUpdate({
      target: cryptoPrices.symbol,
      set: {
        priceUsd: snapshot.priceUsd,
        change1h: snapshot.change1h,
        change24h: snapshot.change24h,
        change7d: snapshot.change7d,
        volume24h: snapshot.volume24h,
        marketCap: snapshot.marketCap,
        source: snapshot.source,
        updatedAt: snapshot.updatedAt ?? new Date(),
      },
    });
}

export function appendPricePoint(point: NewCryptoPricePoint) {
  return db.insert(cryptoPricePoints).values(point);
}

// ── Alert rules ─────────────────────────────────────────────────────────

export function listActiveAlertRules() {
  return db.select().from(cryptoAlertRules).where(eq(cryptoAlertRules.active, true));
}

export function listAlertRulesByUser(userId: string, opts?: { activeOnly?: boolean }) {
  const conditions = [eq(cryptoAlertRules.userId, userId)];
  if (opts?.activeOnly) conditions.push(eq(cryptoAlertRules.active, true));
  return db
    .select()
    .from(cryptoAlertRules)
    .where(and(...conditions))
    .orderBy(desc(cryptoAlertRules.createdAt));
}

export function getAlertRuleById(id: string) {
  return db
    .select()
    .from(cryptoAlertRules)
    .where(eq(cryptoAlertRules.id, id))
    .then((rows) => rows[0] ?? null);
}

export function createAlertRule(data: NewCryptoAlertRule) {
  return db.insert(cryptoAlertRules).values(data).returning().then((rows) => rows[0]);
}

export function updateAlertRule(id: string, patch: Partial<NewCryptoAlertRule>) {
  return db
    .update(cryptoAlertRules)
    .set(patch)
    .where(eq(cryptoAlertRules.id, id))
    .returning()
    .then((rows) => rows[0] ?? null);
}

export function softDeleteAlertRule(id: string) {
  const now = new Date();
  return db
    .update(cryptoAlertRules)
    .set({ deletedAt: now, active: false, updatedAt: now })
    .where(eq(cryptoAlertRules.id, id))
    .returning()
    .then((rows) => rows[0] ?? null);
}

export function bumpAlertRuleTrigger(id: string, lastTriggeredAt: Date = new Date()) {
  return db
    .update(cryptoAlertRules)
    .set({ lastTriggeredAt, triggerCount: sql`${cryptoAlertRules.triggerCount} + 1` })
    .where(eq(cryptoAlertRules.id, id))
    .returning()
    .then((rows) => rows[0] ?? null);
}

// ── Alert events ────────────────────────────────────────────────────────

export function createAlertEvent(event: NewCryptoAlertEvent) {
  return db.insert(cryptoAlertEvents).values(event).returning().then((rows) => rows[0]);
}

export function getAlertHistory(ruleId: string, limit = 50) {
  return db
    .select()
    .from(cryptoAlertEvents)
    .where(eq(cryptoAlertEvents.ruleId, ruleId))
    .orderBy(desc(cryptoAlertEvents.createdAt))
    .limit(limit);
}

export function countAlertEventsSince(date: Date) {
  return db
    .select({ value: count() })
    .from(cryptoAlertEvents)
    .where(gte(cryptoAlertEvents.createdAt, date))
    .then((rows) => rows[0]?.value ?? 0);
}

// ── Telegram users ──────────────────────────────────────────────────────

export function getTelegramUserById(telegramId: string) {
  return db
    .select()
    .from(cryptoTelegramUsers)
    .where(eq(cryptoTelegramUsers.telegramId, telegramId))
    .then((rows) => rows[0] ?? null);
}

export function listAuthorizedTelegramUsers() {
  return db
    .select()
    .from(cryptoTelegramUsers)
    .where(eq(cryptoTelegramUsers.authorized, true))
    .orderBy(asc(cryptoTelegramUsers.createdAt));
}

export function upsertTelegramUser(data: NewCryptoTelegramUser) {
  return db
    .insert(cryptoTelegramUsers)
    .values(data)
    .onConflictDoUpdate({
      target: cryptoTelegramUsers.telegramId,
      set: {
        telegramUserId: data.telegramUserId,
        telegramUsername: data.telegramUsername,
        firstName: data.firstName,
        timezone: data.timezone,
        role: data.role,
        authorized: data.authorized,
      },
    })
    .returning()
    .then((rows) => rows[0]);
}

export function deauthorizeTelegramUser(telegramId: string) {
  return db
    .update(cryptoTelegramUsers)
    .set({ authorized: false })
    .where(eq(cryptoTelegramUsers.telegramId, telegramId))
    .returning()
    .then((rows) => rows[0] ?? null);
}

// ── Logs ────────────────────────────────────────────────────────────────

export function createLog(entry: NewCryptoIntelLog) {
  return db.insert(cryptoIntelLogs).values(entry);
}

export interface LogFilter {
  source?: NewCryptoIntelLog["source"];
  level?: NewCryptoIntelLog["level"];
  limit?: number;
}

export function listLogs(filter: LogFilter = {}) {
  const { source, level, limit = 100 } = filter;
  const conditions = [];
  if (source) conditions.push(eq(cryptoIntelLogs.source, source));
  if (level) conditions.push(eq(cryptoIntelLogs.level, level));

  const query = db.select().from(cryptoIntelLogs);
  const filtered = conditions.length > 0 ? query.where(and(...conditions)) : query;
  return filtered.orderBy(desc(cryptoIntelLogs.timestamp)).limit(limit);
}

export function countErrorLogsSince(date: Date) {
  return db
    .select({ value: count() })
    .from(cryptoIntelLogs)
    .where(and(eq(cryptoIntelLogs.level, "error"), gte(cryptoIntelLogs.timestamp, date)))
    .then((rows) => rows[0]?.value ?? 0);
}
