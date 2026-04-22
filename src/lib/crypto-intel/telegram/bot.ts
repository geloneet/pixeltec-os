// src/lib/crypto-intel/telegram/bot.ts
// Instancia singleton. Expone getBot() y ensureBotInit() para el webhook.

import { Bot, session } from "grammy";
import type { BotContext, SessionData } from "./context";
import { authMiddleware } from "./middleware/auth";
import { handleError } from "./middleware/error-handler";
import { handleStart } from "./handlers/start";
import { handlePricesView, handlePriceDetail } from "./handlers/prices";
import {
  handleAlertsList,
  handleAlertDelete,
  handleAlertNewStep1,
  handleAlertFlow,
} from "./handlers/alerts";
import { handlePortfolio } from "./handlers/portfolio";
import {
  handleAdminStatus,
  handleAdminSync,
  handleAdminLogs,
  handleAdminUsers,
} from "./handlers/admin";
import { mainMenuKeyboard } from "./keyboards/main-menu";
import { navKeyboard } from "./keyboards/navigation";
import { helpView } from "./views/templates";
import { syncPrices } from "../price-engine";

// Re-exportar para compatibilidad con webhook route
export type { BotContext, SessionData };

let botInstance: Bot<BotContext> | null = null;
let botInitialized = false;

export async function ensureBotInit(): Promise<void> {
  const bot = getBot();
  if (!botInitialized) {
    await bot.init();
    botInitialized = true;
  }
}

export function getBot(): Bot<BotContext> {
  if (botInstance) return botInstance;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN no está configurado");

  const bot = new Bot<BotContext>(token);

  // Inicializar isAdmin antes de cualquier otro middleware
  bot.use((ctx, next) => {
    ctx.isAdmin = false;
    return next();
  });

  bot.use(session({ initial: (): SessionData => ({}) }));
  bot.use(authMiddleware);

  // ── Comandos ────────────────────────────────────────────────────────────

  bot.command("start", (ctx) =>
    handleStart(ctx).catch((err) => handleError(ctx, err, "cmd:start"))
  );

  bot.command(["ayuda", "help"], async (ctx) => {
    await ctx
      .reply(helpView(ctx.isAdmin), {
        parse_mode: "HTML",
        reply_markup: navKeyboard("home"),
      })
      .catch((err) => handleError(ctx, err, "cmd:ayuda"));
  });

  bot.command("precios", (ctx) =>
    handlePricesView(ctx).catch((err) => handleError(ctx, err, "cmd:precios"))
  );

  bot.command("alertas", (ctx) =>
    handleAlertsList(ctx).catch((err) => handleError(ctx, err, "cmd:alertas"))
  );

  bot.command("portfolio", (ctx) =>
    handlePortfolio(ctx).catch((err) => handleError(ctx, err, "cmd:portfolio"))
  );

  bot.command("status", (ctx) =>
    handleAdminStatus(ctx).catch((err) => handleError(ctx, err, "cmd:status"))
  );

  bot.command("users", (ctx) =>
    handleAdminUsers(ctx).catch((err) => handleError(ctx, err, "cmd:users"))
  );

  bot.command("logs", (ctx) =>
    handleAdminLogs(ctx).catch((err) => handleError(ctx, err, "cmd:logs"))
  );

  bot.command("sync", async (ctx) => {
    if (!ctx.isAdmin) {
      await ctx.reply("⛔ Comando exclusivo de administrador.");
      return;
    }
    const msg = await ctx.reply("⏳ Sincronizando precios…", { parse_mode: "HTML" });
    try {
      const result = await syncPrices();
      await ctx.api.editMessageText(
        ctx.chat!.id,
        msg.message_id,
        `✅ <b>Sync completado</b>\n\n` +
        `• Sincronizados: <code>${result.synced}</code>\n` +
        `• Fallidos: <code>${result.failed.join(", ") || "ninguno"}</code>\n` +
        `• Duración: <code>${result.durationMs}ms</code>`,
        { parse_mode: "HTML" }
      );
    } catch (err) {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        msg.message_id,
        `❌ Sync fallido.\n\n<code>${String(err)}</code>`,
        { parse_mode: "HTML" }
      );
    }
  });

  bot.command("cancelar", async (ctx) => {
    ctx.session.flow = undefined;
    ctx.session.draft = undefined;
    await ctx.reply("Flujo cancelado.", {
      parse_mode: "HTML",
      reply_markup: mainMenuKeyboard(ctx.isAdmin),
    });
  });

  // Comandos deprecated — redirigen a la nueva UX
  bot.command("precio", (ctx) =>
    handlePricesView(ctx).catch((err) => handleError(ctx, err, "cmd:precio-legacy"))
  );
  bot.command("watchlist", (ctx) =>
    handlePricesView(ctx).catch((err) => handleError(ctx, err, "cmd:watchlist-legacy"))
  );
  bot.command("nuevaalerta", async (ctx) => {
    // Redirigir al flow moderno vía session
    ctx.session.flow = "new_alert";
    ctx.session.draft = { step: 1 };
    const list = (await import("../watchlist")).WATCHLIST.map((w) => w.symbol).join(", ");
    await ctx.reply(
      `➕ <b>Nueva alerta — Paso 1/3</b>\n\nDisponibles: <code>${list}</code>\n\nResponde con el símbolo o /cancelar`,
      { parse_mode: "HTML" }
    );
  });
  bot.command("borrar", async (ctx) => {
    const id = ctx.match?.trim();
    if (!id) {
      await ctx.reply("Usa el botón 🗑 en /alertas para borrar.", { parse_mode: "HTML" });
      return;
    }
    const { db, COL } = await import("../firebase-admin");
    const ref = db().collection(COL.alertRules).doc(id);
    const doc = await ref.get();
    if (!doc.exists || doc.data()?.userId !== String(ctx.from!.id)) {
      await ctx.reply("Alerta no encontrada o no te pertenece.", { parse_mode: "HTML" });
      return;
    }
    await ref.update({ active: false });
    await ctx.reply("✅ Alerta desactivada.", {
      parse_mode: "HTML",
      reply_markup: mainMenuKeyboard(ctx.isAdmin),
    });
  });

  // ── Callbacks ────────────────────────────────────────────────────────────

  bot.callbackQuery("nav:home", async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleStart(ctx).catch((err) => handleError(ctx, err, "cb:nav:home"));
  });

  bot.callbackQuery("nav:close", async (ctx) => {
    await ctx.answerCallbackQuery();
    try {
      await ctx.deleteMessage();
    } catch {
      // Mensaje demasiado antiguo (>48h) — editar a texto neutral
      await ctx.editMessageText("Cerrado ✓").catch(() => {});
    }
  });

  bot.callbackQuery("nav:help", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx
      .editMessageText(helpView(ctx.isAdmin), {
        parse_mode: "HTML",
        reply_markup: navKeyboard("home"),
      })
      .catch((err) => handleError(ctx, err, "cb:nav:help"));
  });

  bot.callbackQuery(/^nav:back:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const target = ctx.match[1];
    const handlers: Record<string, (c: BotContext) => Promise<void>> = {
      home: handleStart,
      prices: handlePricesView,
      alerts: handleAlertsList,
      portfolio: handlePortfolio,
      admin: handleAdminStatus,
    };
    const fn = handlers[target] ?? handleStart;
    await fn(ctx).catch((err) => handleError(ctx, err, `cb:nav:back:${target}`));
  });

  bot.callbackQuery("prices:view", async (ctx) => {
    await ctx.answerCallbackQuery();
    await handlePricesView(ctx).catch((err) => handleError(ctx, err, "cb:prices:view"));
  });

  // prices:detail:<SYMBOL>:<from>
  bot.callbackQuery(/^prices:detail:([A-Z]+):([a-z])$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const symbol = ctx.match[1];
    await handlePriceDetail(ctx, symbol).catch((err) =>
      handleError(ctx, err, `cb:prices:detail:${symbol}`)
    );
  });

  bot.callbackQuery("alerts:list", async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleAlertsList(ctx).catch((err) => handleError(ctx, err, "cb:alerts:list"));
  });

  bot.callbackQuery("alerts:new:1", async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleAlertNewStep1(ctx).catch((err) => handleError(ctx, err, "cb:alerts:new:1"));
  });

  bot.callbackQuery(/^alerts:del:(.+)$/, async (ctx) => {
    // answerCallbackQuery lo hace el handler (puede mostrar toast de error)
    const alertId = ctx.match[1];
    await handleAlertDelete(ctx, alertId).catch((err) =>
      handleError(ctx, err, `cb:alerts:del:${alertId}`)
    );
  });

  bot.callbackQuery("portfolio:view", async (ctx) => {
    await ctx.answerCallbackQuery();
    await handlePortfolio(ctx).catch((err) => handleError(ctx, err, "cb:portfolio:view"));
  });

  bot.callbackQuery("admin:status", async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleAdminStatus(ctx).catch((err) => handleError(ctx, err, "cb:admin:status"));
  });

  bot.callbackQuery("admin:sync", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Iniciando sync…" });
    await handleAdminSync(ctx).catch((err) => handleError(ctx, err, "cb:admin:sync"));
  });

  bot.callbackQuery("admin:logs", async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleAdminLogs(ctx).catch((err) => handleError(ctx, err, "cb:admin:logs"));
  });

  bot.callbackQuery("admin:users", async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleAdminUsers(ctx).catch((err) => handleError(ctx, err, "cb:admin:users"));
  });

  // ── Texto libre (flujo de alertas) ────────────────────────────────────────

  bot.on("message:text", async (ctx) => {
    const consumed = await handleAlertFlow(ctx).catch((err) => {
      handleError(ctx, err, "msg:alert-flow");
      return true;
    });
    if (!consumed) {
      // Mensaje de texto fuera de flujo — mostrar menú principal
      await ctx
        .reply(
          `No entendí ese mensaje. Usa los botones o /start para ver el menú.`,
          { parse_mode: "HTML", reply_markup: mainMenuKeyboard(ctx.isAdmin) }
        )
        .catch(() => {});
    }
  });

  // ── Error handler global ───────────────────────────────────────────────────

  bot.catch((err) => {
    console.error("[telegram-bot] unhandled grammy error", {
      message: err.message,
      update: err.ctx?.update,
    });
  });

  botInstance = bot;
  return bot;
}
