import { Timestamp } from "firebase-admin/firestore";
import type { BotContext } from "../context";
import { db, COL } from "../../firebase-admin";
import type { AlertRule } from "../../types";
import { WATCHLIST } from "../../watchlist";
import { alertsView } from "../views/templates";
import { alertsKeyboard, alertsEmptyKeyboard } from "../keyboards/alerts";
import { mainMenuKeyboard } from "../keyboards/main-menu";

type RuleWithId = AlertRule & { id: string };

export async function handleAlertsList(ctx: BotContext): Promise<void> {
  const userId = String(ctx.from!.id);
  const snap = await db()
    .collection(COL.alertRules)
    .where("userId", "==", userId)
    .where("active", "==", true)
    .get();

  const rules: RuleWithId[] = snap.docs.map((d) => ({
    ...(d.data() as AlertRule),
    id: d.id,
  }));

  const text = alertsView(rules);
  const markup = rules.length > 0 ? alertsKeyboard(rules) : alertsEmptyKeyboard();

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: markup });
  } else {
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: markup });
  }
}

export async function handleAlertDelete(
  ctx: BotContext,
  alertId: string
): Promise<void> {
  const userId = String(ctx.from!.id);
  const ref = db().collection(COL.alertRules).doc(alertId);
  const doc = await ref.get();

  if (!doc.exists || doc.data()?.userId !== userId) {
    await ctx.answerCallbackQuery({ text: "Alerta no encontrada.", show_alert: true });
    return;
  }

  await ref.update({ active: false });
  await ctx.answerCallbackQuery({ text: "✅ Alerta eliminada" });
  await handleAlertsList(ctx);
}

export async function handleAlertNewStep1(ctx: BotContext): Promise<void> {
  ctx.session.flow = "new_alert";
  ctx.session.draft = { step: 1 };
  const list = WATCHLIST.map((w) => w.symbol).join(", ");

  await ctx.editMessageText(
    `➕ <b>Nueva alerta — Paso 1/3</b>\n\n` +
    `¿Qué asset?\n\nDisponibles: <code>${list}</code>\n\n` +
    `Responde con el símbolo (ej: <code>BTC</code>) o /cancelar`,
    { parse_mode: "HTML" }
  );
}

export async function handleAlertFlow(ctx: BotContext): Promise<boolean> {
  if (ctx.session.flow !== "new_alert" || !ctx.session.draft) return false;

  const draft = ctx.session.draft;
  const text = (ctx.message as { text?: string })?.text?.trim() ?? "";

  if (!text) return true;

  // Step 1: symbol
  if (draft.step === 1) {
    const symbol = text.toUpperCase();
    if (!WATCHLIST.some((w) => w.symbol === symbol)) {
      await ctx.reply(
        `❌ Símbolo inválido. Intenta de nuevo o /cancelar.`,
        { parse_mode: "HTML" }
      );
      return true;
    }
    draft.symbol = symbol;
    draft.step = 2;
    await ctx.reply(
      `<b>Paso 2/3</b> — ¿Tipo de alerta?\n\n` +
      `• <code>above</code> — cuando supere un precio\n` +
      `• <code>below</code> — cuando baje de un precio\n` +
      `• <code>change</code> — cuando varíe X% en 24h\n\n` +
      `Responde: <code>above</code>, <code>below</code> o <code>change</code>`,
      { parse_mode: "HTML" }
    );
    return true;
  }

  // Step 2: type
  if (draft.step === 2) {
    const map: Record<string, AlertRule["type"]> = {
      above: "price_above",
      below: "price_below",
      change: "change_percent",
    };
    const t = map[text.toLowerCase()];
    if (!t) {
      await ctx.reply(
        `❌ Opción inválida. Responde: <code>above</code>, <code>below</code> o <code>change</code>`,
        { parse_mode: "HTML" }
      );
      return true;
    }
    draft.type = t;
    draft.step = 3;
    const prompt =
      t === "change_percent"
        ? `<b>Paso 3/3</b> — ¿Qué porcentaje? (ej: <code>5</code> para 5%)`
        : `<b>Paso 3/3</b> — ¿Precio umbral en USD? (ej: <code>58000</code>)`;
    await ctx.reply(prompt, { parse_mode: "HTML" });
    return true;
  }

  // Step 3: threshold
  if (draft.step === 3) {
    const threshold = parseFloat(text.replace(/[,$]/g, ""));
    if (!Number.isFinite(threshold) || threshold <= 0) {
      await ctx.reply(
        `❌ Número inválido. Intenta de nuevo o /cancelar.`,
        { parse_mode: "HTML" }
      );
      return true;
    }

    const rule: AlertRule = {
      userId: String(ctx.from!.id),
      symbol: draft.symbol!,
      type: draft.type!,
      params: {
        threshold,
        ...(draft.type === "change_percent"
          ? { window: "24h" as const, direction: "down" as const }
          : {}),
      },
      channels: ["telegram"],
      cooldownMinutes: 60,
      active: true,
      createdAt: Timestamp.now(),
    };

    const ref = await db().collection(COL.alertRules).add(rule);
    ctx.session.flow = undefined;
    ctx.session.draft = undefined;

    await ctx.reply(
      `✅ <b>Alerta creada</b>\n\n` +
      `ID: <code>${ref.id}</code>\n` +
      `Asset: <b>${rule.symbol}</b>\n` +
      `Umbral: ${threshold}\n\n` +
      `<i>Te notificaré cuando se dispare. Cooldown: 60 min.</i>`,
      { parse_mode: "HTML", reply_markup: mainMenuKeyboard(ctx.isAdmin) }
    );
    return true;
  }

  return true;
}
