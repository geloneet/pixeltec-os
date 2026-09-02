import type { MessageTemplate } from "@/lib/whatsapp/management-types";

/**
 * Semántica visual de la pestaña Cuenta (WO-2026-00181).
 *
 * Mismo criterio que `ui/meta.ts`: los enums que devuelve Graph son inglés de
 * máquina (`GREEN`, `PENDING`, `TIER_1K`) y aquí —y solo aquí— se traducen a
 * lenguaje de producto con su color. Ningún estado depende únicamente del
 * color: siempre hay etiqueta en texto.
 *
 * Todos los mapas tienen `fallback`: Meta agrega valores nuevos sin avisar y
 * una pantalla que se rompe ante un enum desconocido es justo lo que hace
 * fallar un App Review.
 */

interface VisualMeta {
  label: string;
  className: string;
}

const NEUTRAL = "border-border bg-muted text-muted-foreground";

/** Calidad del número según Meta. Verde/ámbar/rojo, con etiqueta explícita. */
export const QUALITY_META: Record<string, VisualMeta> = {
  GREEN: { label: "Alta", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  YELLOW: { label: "Media", className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  RED: { label: "Baja", className: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300" },
  UNKNOWN: { label: "Sin datos", className: NEUTRAL },
};

export function qualityMeta(rating: string | null): VisualMeta {
  if (!rating) return { label: "Sin datos", className: NEUTRAL };
  return QUALITY_META[rating] ?? { label: rating, className: NEUTRAL };
}

/** Estado del nombre verificado (`name_status`). */
const NAME_STATUS_LABELS: Record<string, string> = {
  APPROVED: "Aprobado",
  AVAILABLE_WITHOUT_REVIEW: "Disponible sin revisión",
  DECLINED: "Rechazado",
  EXPIRED: "Expirado",
  PENDING_REVIEW: "En revisión",
  NONE: "Sin nombre",
};

/** Verificación del número por código (`code_verification_status`). */
const CODE_VERIFICATION_LABELS: Record<string, string> = {
  VERIFIED: "Verificado",
  NOT_VERIFIED: "Sin verificar",
  EXPIRED: "Expirado",
};

/** Límite de conversaciones iniciadas por la empresa en 24 h. */
const MESSAGING_TIER_LABELS: Record<string, string> = {
  TIER_50: "50 conversaciones / 24 h",
  TIER_250: "250 conversaciones / 24 h",
  TIER_1K: "1 000 conversaciones / 24 h",
  TIER_10K: "10 000 conversaciones / 24 h",
  TIER_100K: "100 000 conversaciones / 24 h",
  TIER_UNLIMITED: "Sin límite",
};

/** Vertical del perfil de empresa (`vertical`). */
const VERTICAL_LABELS: Record<string, string> = {
  AUTO: "Automotriz",
  BEAUTY: "Belleza y cuidado personal",
  APPAREL: "Ropa",
  EDU: "Educación",
  ENTERTAIN: "Entretenimiento",
  EVENT_PLAN: "Eventos",
  FINANCE: "Finanzas",
  GROCERY: "Supermercado",
  GOVT: "Gobierno",
  HOTEL: "Hotelería",
  HEALTH: "Salud",
  NONPROFIT: "Organización sin fines de lucro",
  PROF_SERVICES: "Servicios profesionales",
  RETAIL: "Comercio minorista",
  TRAVEL: "Viajes",
  RESTAURANT: "Restaurante",
  OTHER: "Otro",
};

/** Traduce un enum de Graph; si es desconocido devuelve el valor tal cual. */
function translate(map: Record<string, string>, value: string | null): string | null {
  if (!value) return null;
  return map[value] ?? value;
}

export const nameStatusLabel = (v: string | null) => translate(NAME_STATUS_LABELS, v);
export const codeVerificationLabel = (v: string | null) => translate(CODE_VERIFICATION_LABELS, v);
export const messagingTierLabel = (v: string | null) => translate(MESSAGING_TIER_LABELS, v);
export const verticalLabel = (v: string | null) => translate(VERTICAL_LABELS, v);

/** Estado de una plantilla. El que Meta devuelve tras crearla es `PENDING`. */
export const TEMPLATE_STATUS_META: Record<string, VisualMeta> = {
  APPROVED: { label: "Aprobada", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  PENDING: { label: "En revisión", className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  REJECTED: { label: "Rechazada", className: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300" },
  PAUSED: { label: "Pausada", className: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300" },
  DISABLED: { label: "Deshabilitada", className: NEUTRAL },
};

export function templateStatusMeta(status: string): VisualMeta {
  return TEMPLATE_STATUS_META[status] ?? { label: status, className: NEUTRAL };
}

const CATEGORY_LABELS: Record<string, string> = {
  UTILITY: "Utilidad",
  MARKETING: "Marketing",
  AUTHENTICATION: "Autenticación",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

/**
 * Texto del componente BODY, que es el único que la lista previsualiza.
 * Meta garantiza como máximo un BODY por plantilla.
 */
export function templateBody(template: MessageTemplate): string | null {
  return template.components.find((c) => c.type === "BODY")?.text ?? null;
}

/**
 * Variables `{{n}}` presentes en un cuerpo, ordenadas y sin repetir.
 *
 * El diálogo pide un ejemplo por variable porque Meta rechaza sin más las
 * plantillas con variables y sin `example.body_text`. Se detectan en el
 * cliente para que el revisor vea los campos aparecer mientras escribe, no
 * después de un 400.
 */
export function bodyVariables(body: string): number[] {
  const found = new Set<number>();
  for (const match of body.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) {
    found.add(Number(match[1]));
  }
  return [...found].sort((a, b) => a - b);
}
