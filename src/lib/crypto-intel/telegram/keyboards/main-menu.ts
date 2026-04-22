import { InlineKeyboard } from "grammy";

export function mainMenuKeyboard(isAdmin: boolean): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text("💹 Precios", "prices:view")
    .text("🔔 Alertas", "alerts:list")
    .row()
    .text("📊 Portfolio", "portfolio:view")
    .text("❓ Ayuda", "nav:help");

  if (isAdmin) {
    kb.row().text("⚙️ Admin", "admin:status");
  }

  return kb;
}
