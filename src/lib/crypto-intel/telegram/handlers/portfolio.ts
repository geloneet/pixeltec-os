import type { BotContext } from "../context";
import { portfolioView } from "../views/templates";
import { navKeyboard } from "../keyboards/navigation";

export async function handlePortfolio(ctx: BotContext): Promise<void> {
  const text = portfolioView();
  const markup = navKeyboard("home");

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: markup });
  } else {
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: markup });
  }
}
