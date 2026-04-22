import type { BotContext } from "../context";
import { db, COL } from "../../firebase-admin";
import { syncPrices } from "../../price-engine";
import { adminStatusView } from "../views/templates";
import { adminKeyboard } from "../keyboards/admin";
import { navKeyboard } from "../keyboards/navigation";

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export async function handleAdminStatus(ctx: BotContext): Promise<void> {
  if (!ctx.isAdmin) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: "Sin acceso", show_alert: true });
    } else {
      await ctx.reply("⛔ Comando exclusivo de administrador.");
    }
    return;
  }

  const alertsSnap = await db()
    .collection(COL.alertRules)
    .where("active", "==", true)
    .get();

  const text = adminStatusView({
    uptime: formatUptime(process.uptime()),
    alertRules: alertsSnap.size,
  });

  const markup = adminKeyboard();

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: markup });
  } else {
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: markup });
  }
}

export async function handleAdminSync(ctx: BotContext): Promise<void> {
  // Always called from callback — answerCallbackQuery already done by caller
  await ctx.editMessageText("⏳ Sincronizando precios…", { parse_mode: "HTML" });

  try {
    const result = await syncPrices();
    await ctx.editMessageText(
      `✅ <b>Sync completado</b>\n\n` +
      `• Sincronizados: <code>${result.synced}</code>\n` +
      `• Fallidos: <code>${result.failed.join(", ") || "ninguno"}</code>\n` +
      `• Duración: <code>${result.durationMs}ms</code>`,
      { parse_mode: "HTML", reply_markup: adminKeyboard() }
    );
  } catch (err) {
    await ctx.editMessageText(
      `❌ <b>Sync fallido</b>\n\n<code>${String(err)}</code>`,
      { parse_mode: "HTML", reply_markup: adminKeyboard() }
    );
  }
}

export async function handleAdminLogs(ctx: BotContext): Promise<void> {
  if (!ctx.isAdmin) {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: "Sin acceso", show_alert: true });
    return;
  }

  const text =
    `📋 <b>Logs</b>\n` +
    `━━━━━━━━━━━━━━━\n\n` +
    `Los logs del contenedor están disponibles en el VPS:\n\n` +
    `<code>docker logs pixeltec-app --tail 50</code>\n\n` +
    `<i>En una fase futura los últimos errores se mostrarán aquí.</i>`;

  const markup = navKeyboard("admin");

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: markup });
  } else {
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: markup });
  }
}

export async function handleAdminUsers(ctx: BotContext): Promise<void> {
  if (!ctx.isAdmin) {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: "Sin acceso", show_alert: true });
    return;
  }

  const snap = await db()
    .collection(COL.telegramUsers)
    .where("authorized", "==", true)
    .get();

  const lines = snap.docs.map(
    (d) => `• <code>${d.id}</code> — ${d.data().firstName ?? "—"}`
  );

  const text =
    `👥 <b>Usuarios autorizados (${snap.size})</b>\n` +
    `━━━━━━━━━━━━━━━\n\n` +
    (lines.length > 0 ? lines.join("\n") : "Ninguno registrado.");

  const markup = navKeyboard("admin");

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: markup });
  } else {
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: markup });
  }
}
