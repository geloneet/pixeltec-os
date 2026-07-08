import type { MiddlewareFn } from "grammy";
import { getTelegramUserById } from "@/lib/db/repos/crypto-intel";
import type { BotContext } from "../context";

export const ADMIN_ID = 1154245961;

export const authMiddleware: MiddlewareFn<BotContext> = async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const user = await getTelegramUserById(String(userId));

  if (!user || !user.authorized) {
    await ctx.reply(
      `⛔ <b>Acceso restringido</b>\n\n` +
      `Este bot es privado. Tu Telegram ID:\n` +
      `<code>${userId}</code>\n\n` +
      `Comparte este ID con el administrador para solicitar acceso.`,
      { parse_mode: "HTML" }
    );
    return;
  }

  ctx.isAdmin = userId === ADMIN_ID;
  await next();
};
