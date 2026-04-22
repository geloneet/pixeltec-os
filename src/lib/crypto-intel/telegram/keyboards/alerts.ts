import { InlineKeyboard } from "grammy";
import type { AlertRule } from "../../types";

export function alertsKeyboard(
  rules: Array<AlertRule & { id: string }>
): InlineKeyboard {
  const kb = new InlineKeyboard();

  rules.forEach((r, i) => {
    if (i > 0 && i % 3 === 0) kb.row();
    kb.text(`🗑 ${r.symbol}`, `alerts:del:${r.id}`);
  });

  kb.row()
    .text("➕ Nueva alerta", "alerts:new:1")
    .row()
    .text("⬅️ Atrás", "nav:back:home")
    .text("🏠 Menú", "nav:home")
    .text("❌ Cerrar", "nav:close");

  return kb;
}

export function alertsEmptyKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("➕ Nueva alerta", "alerts:new:1")
    .row()
    .text("⬅️ Atrás", "nav:back:home")
    .text("🏠 Menú", "nav:home")
    .text("❌ Cerrar", "nav:close");
}
