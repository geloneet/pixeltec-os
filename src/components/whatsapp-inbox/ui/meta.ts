import { Bot, Hand, PauseCircle, type LucideIcon } from "lucide-react";
import { parseCanonical } from "@/lib/whatsapp-inbox/time";
import type { WhatsAppMode } from "@/types/whatsapp-inbox";

/**
 * Fuente única de la semántica visual del modo de automatización.
 *
 * Antes vivían tres mapas divergentes (ConversationList, ContactPanel,
 * ModeToggle) con labels distintos para el mismo estado ("Tú" vs "Control
 * humano"). Cualquier superficie que pinte el modo — lista, hilo, ficha —
 * consume este mapa; agregar una cuarta copia es una regresión.
 *
 * Paleta (dirección visual del plan): cian = bot, verde = intervención
 * humana, ámbar = pausa. Ningún estado depende solo del color: siempre
 * hay label + icono.
 */
export const MODE_META: Record<
  WhatsAppMode,
  {
    /** Label completo, lenguaje de producto ("Bot respondiendo"). */
    label: string;
    /** Label corto para filas y espacios angostos ("Bot"). */
    shortLabel: string;
    icon: LucideIcon;
    /** Badge/beacon en reposo. */
    className: string;
    /** Estado seleccionado/activo en controles. */
    activeClassName: string;
  }
> = {
  BOT: {
    label: "Bot respondiendo",
    shortLabel: "Bot",
    icon: Bot,
    className: "text-cyan-700 dark:text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
    activeClassName: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/40",
  },
  HUMAN: {
    label: "Control humano",
    shortLabel: "Humano",
    icon: Hand,
    className: "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    activeClassName: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
  },
  PAUSED: {
    label: "Bot pausado",
    shortLabel: "Pausa",
    icon: PauseCircle,
    className: "text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/30",
    activeClassName: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40",
  },
};

/** Docs previos al takeover no traen `mode`: el bot sigue a cargo. */
export function resolveMode(mode?: WhatsAppMode | null): WhatsAppMode {
  return mode ?? "BOT";
}

/**
 * Label del modo con la pausa temporal resuelta: "Bot pausado hasta 14:30".
 * `pausedUntil` llega como ISO (lo escribe el propio front al pausar).
 */
export function modeLabel(mode?: WhatsAppMode | null, pausedUntil?: string | null): string {
  const meta = MODE_META[resolveMode(mode)];
  if (resolveMode(mode) === "PAUSED" && pausedUntil) {
    const until = new Date(pausedUntil);
    if (!Number.isNaN(until.getTime()) && until.getTime() > Date.now()) {
      return `Bot pausado hasta ${until.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`;
    }
  }
  return meta.label;
}

/** Status de una versión de configuración, traducido (§9: sin jerga). */
export const VERSION_STATUS_META: Record<
  "draft" | "active" | "archived",
  { label: string; className: string }
> = {
  draft: { label: "Borrador", className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  active: { label: "Activa", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  archived: { label: "Archivada", className: "border-border bg-muted text-muted-foreground" },
};

/**
 * Importancia de un ejemplo de entrenamiento. La API conserva el entero
 * `manual_priority` (0–20); la UI habla en niveles. El número exacto sigue
 * visible en Avanzado para administradores.
 */
export const IMPORTANCE_LEVELS = [
  { id: "normal", label: "Normal", priority: 5, description: "Se usa cuando el tema coincide" },
  { id: "alta", label: "Alta", priority: 12, description: "Preferido sobre ejemplos normales" },
  { id: "critica", label: "Crítica", priority: 20, description: "El bot lo sigue siempre que aplique" },
] as const;

export type ImportanceId = (typeof IMPORTANCE_LEVELS)[number]["id"];

export function importanceFromPriority(priority: number): (typeof IMPORTANCE_LEVELS)[number] {
  if (priority >= 16) return IMPORTANCE_LEVELS[2];
  if (priority >= 9) return IMPORTANCE_LEVELS[1];
  return IMPORTANCE_LEVELS[0];
}

/**
 * Tiempo relativo sobre el timestamp canónico del bot ('YYYY-MM-DD HH:MM:SS'
 * UTC). Dos estilos: `compact` para filas ("2m", "3h") y `phrase` para la
 * ficha ("hace 2m", "el 12 mar"). Sustituye las dos copias locales que
 * divergían entre lista y ficha.
 */
export function formatRelative(canonical: string | undefined, style: "compact" | "phrase" = "compact"): string {
  if (!canonical) return style === "compact" ? "" : "sin datos";
  const date = parseCanonical(canonical);
  if (Number.isNaN(date.getTime())) return style === "compact" ? "" : "sin datos";
  const mins = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (mins < 1) return style === "compact" ? "ahora" : "hace instantes";
  if (mins < 60) return style === "compact" ? `${mins}m` : `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return style === "compact" ? `${hours}h` : `hace ${hours}h`;
  const day = date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  return style === "compact" ? day : `el ${day}`;
}

/** Mensaje de error de los proxies /api/whatsapp-inbox/* (shape estable). */
export function extractErrorMessage(data: { error?: string; detail?: string }, status: number): string {
  return data.error ?? data.detail ?? `HTTP ${status}`;
}
