import { InlineKeyboard } from "grammy";

export type NavParent =
  | "home"
  | "prices"
  | "alerts"
  | "portfolio"
  | "admin";

export function navKeyboard(back: NavParent = "home"): InlineKeyboard {
  return new InlineKeyboard()
    .text("⬅️ Atrás", `nav:back:${back}`)
    .text("🏠 Menú", "nav:home")
    .text("❌ Cerrar", "nav:close");
}
