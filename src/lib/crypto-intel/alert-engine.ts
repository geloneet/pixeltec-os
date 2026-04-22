// src/lib/crypto-intel/alert-engine.ts
// Evaluador de reglas. Llamado por cron /api/crypto-intel/alerts/evaluate cada minuto.
// En Fase 1 soporta price_below, price_above y change_percent.
// Fase 2 añadirá rsi_extreme, ma_cross, volume_spike.

import { Timestamp } from "firebase-admin/firestore";
import { db, COL } from "./firebase-admin";
import { getLatestPrice } from "./price-engine";
import { sendTelegramAlert } from "./telegram/sender";
import { log } from "./logger";
import type { AlertRule, AlertEvent, PriceSnapshot } from "./types";

interface EvaluationSummary {
  evaluated: number;
  triggered: number;
  skippedCooldown: number;
  errors: number;
}

export async function evaluateAllAlerts(): Promise<EvaluationSummary> {
  const firestore = db();
  const now = Timestamp.now();
  const summary: EvaluationSummary = {
    evaluated: 0,
    triggered: 0,
    skippedCooldown: 0,
    errors: 0,
  };

  const rulesSnap = await firestore
    .collection(COL.alertRules)
    .where("active", "==", true)
    .get();

  await log("alert-engine", "info", "Evaluación iniciada", { rulesCount: rulesSnap.size });

  // Cache precios para no pegarle N veces a firestore
  const priceCache = new Map<string, PriceSnapshot>();

  for (const doc of rulesSnap.docs) {
    summary.evaluated++;
    const rule = { id: doc.id, ...doc.data() } as AlertRule;

    try {
      // Cooldown check
      if (rule.lastTriggeredAt && rule.cooldownMinutes > 0) {
        const elapsed =
          now.toMillis() - rule.lastTriggeredAt.toMillis();
        if (elapsed < rule.cooldownMinutes * 60 * 1000) {
          summary.skippedCooldown++;
          continue;
        }
      }

      // Cargar precio (cacheado)
      let price = priceCache.get(rule.symbol);
      if (!price) {
        const fetched = await getLatestPrice(rule.symbol);
        if (!fetched) continue;
        price = fetched;
        priceCache.set(rule.symbol, price);
      }

      const result = evaluateRule(rule, price);
      if (!result.triggered) continue;

      // Disparar: guardar evento + actualizar regla + notificar
      const event: AlertEvent = {
        ruleId: rule.id!,
        userId: rule.userId,
        symbol: rule.symbol,
        message: result.message,
        payload: { price: price.priceUsd, rule: rule.params },
        deliveredTo: [],
        createdAt: now,
      };

      await firestore.collection(COL.alerts).add(event);
      await doc.ref.update({ lastTriggeredAt: now });

      // Entregar a canales
      if (rule.channels.includes("telegram")) {
        const chatId = (rule as AlertRule & { telegramChatId?: string }).telegramChatId ?? rule.userId;
        await sendTelegramAlert(chatId, result.message);
        event.deliveredTo.push("telegram");
      }

      summary.triggered++;
    } catch (err) {
      console.error(`[alert-engine] error evaluating rule ${rule.id}`, err);
      summary.errors++;
    }
  }

  await log("alert-engine", summary.errors > 0 ? "warn" : "info", "Evaluación completada", summary as unknown as Record<string, unknown>);

  return summary;
}

// ---------- Lógica pura de evaluación (fácil de testear) ----------

interface EvalResult {
  triggered: boolean;
  message: string;
}

export function evaluateRule(
  rule: AlertRule,
  price: PriceSnapshot
): EvalResult {
  switch (rule.type) {
    case "price_below":
      if (
        rule.params.threshold !== undefined &&
        price.priceUsd < rule.params.threshold
      ) {
        return {
          triggered: true,
          message:
            `🔻 *${rule.symbol}* bajó de \`$${rule.params.threshold.toLocaleString()}\`\n` +
            `Precio actual: \`$${price.priceUsd.toLocaleString()}\`\n` +
            `24h: ${formatPct(price.change24h)}`,
        };
      }
      break;

    case "price_above":
      if (
        rule.params.threshold !== undefined &&
        price.priceUsd > rule.params.threshold
      ) {
        return {
          triggered: true,
          message:
            `🔺 *${rule.symbol}* rompió \`$${rule.params.threshold.toLocaleString()}\`\n` +
            `Precio actual: \`$${price.priceUsd.toLocaleString()}\`\n` +
            `24h: ${formatPct(price.change24h)}`,
        };
      }
      break;

    case "change_percent": {
      const window = rule.params.window ?? "24h";
      const changeField =
        window === "1h" ? price.change1h :
        window === "7d" ? price.change7d :
        price.change24h;

      const threshold = rule.params.threshold ?? 0;
      const direction = rule.params.direction ?? "down";

      const hit =
        direction === "down"
          ? changeField <= -Math.abs(threshold)
          : changeField >= Math.abs(threshold);

      if (hit) {
        const emoji = direction === "down" ? "📉" : "📈";
        return {
          triggered: true,
          message:
            `${emoji} *${rule.symbol}* ${formatPct(changeField)} en ${window}\n` +
            `Precio actual: \`$${price.priceUsd.toLocaleString()}\``,
        };
      }
      break;
    }

    default:
      // rsi_extreme, ma_cross, volume_spike — Fase 2
      break;
  }

  return { triggered: false, message: "" };
}

function formatPct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}
