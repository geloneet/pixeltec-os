import type { BotContext } from "../context";
import type { PriceSnapshot, AlertRule } from "../../types";

const BOT_VERSION = "v1.0.0";

function nowCT(): string {
  return new Date().toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function ageMinutes(ms: number): number {
  return Math.floor((Date.now() - ms) / 60_000);
}

function fmtPrice(n: number): string {
  if (n >= 10_000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 1_000) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ---- Views ----

export function startView(ctx: BotContext): string {
  const user = ctx.from!;
  const name = escHtml(user.first_name);
  const username = user.username ? `@${user.username}` : "—";
  const role = ctx.isAdmin ? "✅ Admin" : "✅ Autorizado";

  return (
    `🛡 <b>PIXELTEC · Crypto Intelligence</b>\n` +
    `━━━━━━━━━━━━━━━\n` +
    `Hola, <b>${name}</b> 👋\n` +
    `Precios, alertas y portafolio crypto en tiempo real.\n\n` +
    `<b>Tu sesión</b>\n` +
    `• Nombre:  ${name}\n` +
    `• Usuario: ${username}\n` +
    `• ID:      <code>${user.id}</code>\n` +
    `• Rol:     ${role}\n\n` +
    `<i>${BOT_VERSION} · ${nowCT()} CT</i>\n\n` +
    `Selecciona una opción:`
  );
}

export function pricesView(prices: PriceSnapshot[]): string {
  if (prices.length === 0) {
    return (
      `💹 <b>Precios en tiempo real</b>\n` +
      `━━━━━━━━━━━━━━━\n\n` +
      `Sin datos disponibles. Intenta sincronizar primero.`
    );
  }

  const rows = prices.map((p) => {
    const icon = p.change24h >= 0 ? "🟢" : "🔴";
    const price = `$${fmtPrice(p.priceUsd)}`;
    const pct = fmtPct(p.change24h);
    return `${icon} <b>${p.symbol}</b>  <code>${price.padEnd(12)}</code>${pct}`;
  });

  const oldestMs = prices.reduce(
    (min, p) => Math.min(min, p.updatedAt.toMillis()),
    Infinity
  );
  const age = oldestMs === Infinity ? "—" : `hace ${ageMinutes(oldestMs)} min`;

  return (
    `💹 <b>Precios en tiempo real</b>\n` +
    `━━━━━━━━━━━━━━━\n\n` +
    rows.join("\n") +
    `\n\n<i>Sync: ${age}</i>`
  );
}

export function priceDetailView(p: PriceSnapshot): string {
  const icon = p.change24h >= 0 ? "🟢" : "🔴";
  const age = ageMinutes(p.updatedAt.toMillis());

  return (
    `${icon} <b>${p.symbol} — Detalle</b>\n` +
    `━━━━━━━━━━━━━━━\n\n` +
    `Precio:   <code>$${fmtPrice(p.priceUsd)}</code>\n` +
    `1h:       <code>${fmtPct(p.change1h)}</code>\n` +
    `24h:      <code>${fmtPct(p.change24h)}</code>\n` +
    `7d:       <code>${fmtPct(p.change7d)}</code>\n\n` +
    `Vol 24h:  <code>$${(p.volume24h / 1e9).toFixed(2)}B</code>\n` +
    `Mkt Cap:  <code>$${(p.marketCap / 1e9).toFixed(2)}B</code>\n\n` +
    `<i>Actualizado hace ${age} min · ${p.source}</i>`
  );
}

export function alertsView(
  rules: Array<AlertRule & { id: string }>
): string {
  if (rules.length === 0) {
    return (
      `🔔 <b>Alertas activas</b>\n` +
      `━━━━━━━━━━━━━━━\n\n` +
      `No tienes alertas activas.\n` +
      `Usa "Nueva alerta" para crear una.`
    );
  }

  const lines = rules.map((r, i) => {
    const desc = alertRuleDesc(r);
    return `${i + 1}. <b>${r.symbol}</b> — ${desc}\n   <code>${r.id}</code>`;
  });

  return (
    `🔔 <b>Alertas activas (${rules.length})</b>\n` +
    `━━━━━━━━━━━━━━━\n\n` +
    lines.join("\n\n") +
    `\n\n<i>Toca 🗑 junto al símbolo para eliminar.</i>`
  );
}

export function portfolioView(): string {
  return (
    `📊 <b>Portfolio</b>\n` +
    `━━━━━━━━━━━━━━━\n\n` +
    `🚧 En desarrollo — Portfolio tracking llega en Fase 3.\n\n` +
    `<i>Por ahora puedes monitorear precios y configurar alertas.</i>`
  );
}

export function adminStatusView(info: {
  uptime: string;
  alertRules: number;
}): string {
  return (
    `⚙️ <b>Estado del sistema</b>\n` +
    `━━━━━━━━━━━━━━━\n\n` +
    `• Uptime proceso:  <code>${info.uptime}</code>\n` +
    `• Alertas activas: <code>${info.alertRules}</code>\n\n` +
    `<i>${nowCT()} CT</i>`
  );
}

export function helpView(isAdmin: boolean): string {
  const base =
    `❓ <b>Comandos disponibles</b>\n` +
    `━━━━━━━━━━━━━━━\n\n` +
    `<b>General</b>\n` +
    `/start — Menú principal\n` +
    `/precios — Precios actuales\n` +
    `/alertas — Gestionar alertas\n` +
    `/portfolio — Ver portafolio\n` +
    `/ayuda — Esta pantalla\n`;

  if (!isAdmin) return base;

  return (
    base +
    `\n<b>Admin</b>\n` +
    `/status — Estado del sistema\n` +
    `/sync — Forzar sync de precios\n` +
    `/users — Usuarios autorizados\n` +
    `/logs — Ver últimos errores\n`
  );
}

export function alertRuleDesc(r: AlertRule): string {
  switch (r.type) {
    case "price_above":
      return `supere $${r.params.threshold?.toLocaleString("en-US")}`;
    case "price_below":
      return `baje de $${r.params.threshold?.toLocaleString("en-US")}`;
    case "change_percent":
      return `varíe ≥${r.params.threshold}% en ${r.params.window ?? "24h"}`;
    default:
      return r.type;
  }
}
