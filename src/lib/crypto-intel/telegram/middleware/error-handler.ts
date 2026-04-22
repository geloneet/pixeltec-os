import type { BotContext } from "../context";
import { mainMenuKeyboard } from "../keyboards/main-menu";

const ERROR_TEXT =
  `⚠️ <b>Algo salió mal</b>\n\nIntenta de nuevo o regresa al menú.`;

export async function handleError(
  ctx: BotContext,
  err: unknown,
  location: string
): Promise<void> {
  console.error(`[telegram-bot] error in ${location}`, {
    chatId: ctx.chat?.id,
    userId: ctx.from?.id,
    callbackData: ctx.callbackQuery?.data,
    err,
  });

  const markup = mainMenuKeyboard(ctx.isAdmin);

  try {
    if (ctx.callbackQuery?.message) {
      await ctx.editMessageText(ERROR_TEXT, {
        parse_mode: "HTML",
        reply_markup: markup,
      });
    } else {
      await ctx.reply(ERROR_TEXT, { parse_mode: "HTML", reply_markup: markup });
    }
  } catch {
    console.error("[telegram-bot] failed to deliver error message");
  }
}
