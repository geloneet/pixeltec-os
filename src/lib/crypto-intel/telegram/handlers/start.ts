import type { BotContext } from "../context";
import { startView } from "../views/templates";
import { mainMenuKeyboard } from "../keyboards/main-menu";

export async function handleStart(ctx: BotContext): Promise<void> {
  const text = startView(ctx);
  const markup = mainMenuKeyboard(ctx.isAdmin);

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: markup });
  } else {
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: markup });
  }
}
