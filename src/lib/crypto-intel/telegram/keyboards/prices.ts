import { InlineKeyboard } from "grammy";
import { WATCHLIST } from "../../watchlist";

export function pricesListKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();

  WATCHLIST.forEach((w, i) => {
    if (i > 0 && i % 5 === 0) kb.row();
    kb.text(w.symbol, `prices:detail:${w.symbol}:p`);
  });

  kb.row()
    .text("🔄 Actualizar", "prices:view")
    .row()
    .text("⬅️ Atrás", "nav:back:home")
    .text("🏠 Menú", "nav:home")
    .text("❌ Cerrar", "nav:close");

  return kb;
}

export function priceDetailKeyboard(symbol: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔄 Actualizar", `prices:detail:${symbol}:p`)
    .row()
    .text("⬅️ Atrás", "nav:back:prices")
    .text("🏠 Menú", "nav:home")
    .text("❌ Cerrar", "nav:close");
}
