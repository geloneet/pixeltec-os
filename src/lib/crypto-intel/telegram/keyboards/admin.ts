import { InlineKeyboard } from "grammy";

export function adminKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔄 Sync precios", "admin:sync")
    .row()
    .text("📋 Logs", "admin:logs")
    .text("👥 Usuarios", "admin:users")
    .row()
    .text("⬅️ Atrás", "nav:back:home")
    .text("🏠 Menú", "nav:home")
    .text("❌ Cerrar", "nav:close");
}
