import type { BotContext } from "../context";
import { getLatestPrice } from "../../price-engine";
import { WATCHLIST } from "../../watchlist";
import type { PriceSnapshot } from "../../types";
import { pricesView, priceDetailView } from "../views/templates";
import { pricesListKeyboard, priceDetailKeyboard } from "../keyboards/prices";

export async function handlePricesView(ctx: BotContext): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.editMessageText("⏳ Cargando precios…", { parse_mode: "HTML" });
  }

  const results = await Promise.all(WATCHLIST.map((w) => getLatestPrice(w.symbol)));
  const prices = results.filter((p): p is PriceSnapshot => p !== null);

  const text = pricesView(prices);
  const markup = pricesListKeyboard();

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: markup });
  } else {
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: markup });
  }
}

export async function handlePriceDetail(
  ctx: BotContext,
  symbol: string
): Promise<void> {
  const price = await getLatestPrice(symbol);

  if (!price) {
    await ctx.editMessageText(
      `❌ Sin datos para <b>${symbol}</b>. Intenta sincronizar primero.`,
      { parse_mode: "HTML", reply_markup: priceDetailKeyboard(symbol) }
    );
    return;
  }

  await ctx.editMessageText(priceDetailView(price), {
    parse_mode: "HTML",
    reply_markup: priceDetailKeyboard(symbol),
  });
}
