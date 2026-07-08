// src/lib/crypto-intel/alert-engine.ts
// Evaluador de reglas. Llamado por cron /api/crypto-intel/alerts/evaluate cada minuto.
// En Fase 1 soporta price_below, price_above y change_percent.
// Fase 2 añadirá rsi_extreme, ma_cross, volume_spike.

import {
  bumpAlertRuleTrigger,
  createAlertEvent,
  listActiveAlertRules,
} from "@/lib/db/repos/crypto-intel";
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

export function dbRuleToAlertRule(
  row: Awaited<ReturnType<typeof listActiveAlertRules>>[number]
): AlertRule & { id: string } {
  return {
    id: row.id,
    userId: row.userId,
    symbol: row.symbol,
    type: row.type,
    params: row.params as AlertRule["params"],
    channels: row.channels as AlertRule["channels"],
    cooldownMinutes: row.cooldownMinutes,
    active: row.active,
    lastTriggeredAt: row.lastTriggeredAt ?? undefined,
    createdAt: row.createdAt,
    telegramChatId: row.telegramChatId ?? undefined,
    displayName: row.displayName ?? undefined,
    triggerCount: row.triggerCount,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export async function evaluateAllAlerts(): Promise<EvaluationSummary> {
  const now = new Date();
  const summary: EvaluationSummary = {
    evaluated: 0,
    triggered: 0,
    skippedCooldown: 0,
    errors: 0,
  };

  const rows = await listActiveAlertRules();

  await log("alert-engine", "info", "Evaluación iniciada", { rulesCount: rows.length });

  // Cache precios para no pegarle N veces a la DB
  const priceCache = new Map<string, PriceSnapshot>();

  for (const row of rows) {
    summary.evaluated++;
    const rule = dbRuleToAlertRule(row);

    try {
      // Cooldown check
      if (rule.lastTriggeredAt && rule.cooldownMinutes > 0) {
        const elapsed = now.getTime() - rule.lastTriggeredAt.getTime();
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

      // Disparar: notificar primero, luego persistir evento + regla con el
      // resultado real de la entrega (antes se guardaba `deliveredTo: []` fijo
      // y se actualizaba el cooldown aunque el envío fallara).
      const deliveredTo: string[] = [];
      let deliveredOk = false;

      if (rule.channels.includes("telegram")) {
        const chatId = rule.telegramChatId;
        if (!chatId) {
          console.warn(`[alert-engine] regla ${rule.id} sin telegramChatId configurado — omitiendo entrega`);
        } else {
          try {
            await sendTelegramAlert(chatId, result.message);
            deliveredTo.push("telegram");
            deliveredOk = true;
          } catch (deliveryErr) {
            console.error(`[alert-engine] fallo entregando alerta ${rule.id} por telegram`, deliveryErr);
          }
        }
      }

      await createAlertEvent({
        ruleId: rule.id,
        userId: rule.userId,
        symbol: rule.symbol,
        message: result.message,
        payload: { price: price.priceUsd, rule: rule.params },
        deliveredTo,
      });

      // Solo consumimos el cooldown si la entrega tuvo éxito en al menos un canal
      // (o si no había canales configurados) — un envío fallido debe poder
      // reintentarse en la próxima corrida del cron.
      if (deliveredOk || rule.channels.length === 0) {
        await bumpAlertRuleTrigger(rule.id, now);
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
  const symbol = escapeMarkdownV2(rule.symbol);

  switch (rule.type) {
    case "price_below":
      if (
        rule.params.threshold !== undefined &&
        price.priceUsd < rule.params.threshold
      ) {
        return {
          triggered: true,
          message:
            `🔻 *${symbol}* bajó de \`$${rule.params.threshold.toLocaleString()}\`\n` +
            `Precio actual: \`$${price.priceUsd.toLocaleString()}\`\n` +
            `24h: \`${formatPct(price.change24h)}\``,
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
            `🔺 *${symbol}* rompió \`$${rule.params.threshold.toLocaleString()}\`\n` +
            `Precio actual: \`$${price.priceUsd.toLocaleString()}\`\n` +
            `24h: \`${formatPct(price.change24h)}\``,
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
            `${emoji} *${symbol}* \`${formatPct(changeField)}\` en ${window}\n` +
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

/**
 * Escapa los caracteres reservados de Telegram MarkdownV2 en texto que va
 * FUERA de una entidad (negritas `*..*`, código `` `..` ``, etc). Dentro de
 * backticks/asteriscos ya usados arriba para los valores numéricos no hace
 * falta escapar `.`/`-`, pero el símbolo (texto libre de configuración) sí
 * puede contener alguno de estos caracteres reservados.
 */
function escapeMarkdownV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}
