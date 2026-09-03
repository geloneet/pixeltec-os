/**
 * Ventanas de comparación (WO-2026-00214).
 *
 * Función pura: recibe la fecha de referencia como argumento y nunca lee el
 * reloj por su cuenta. Un módulo de analítica que consulta `new Date()` por
 * dentro es imposible de testear sin congelar el tiempo global, y su resultado
 * cambia entre el render del servidor y el del cliente.
 */

import { WINDOW_DAYS } from "./config";

/** Rango cerrado por ambos extremos, en fechas `YYYY-MM-DD`. */
export interface DateWindow {
  /** Primer día incluido (`YYYY-MM-DD`). */
  start: string;
  /** Último día incluido (`YYYY-MM-DD`). */
  end: string;
}

export interface ComparisonWindows {
  /** Los últimos `days` días. */
  current: DateWindow;
  /** Los `days` días inmediatamente anteriores, sin solaparse. */
  previous: DateWindow;
  days: number;
}

/** `YYYY-MM-DD` en UTC — la misma forma en la que Postgres devuelve un `date`. */
export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Fecha desplazada `days` días (puede ser negativo), sin mutar la original. */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** Días de diferencia entre dos claves `YYYY-MM-DD` (b − a). */
export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/**
 * Ventana actual y ventana anterior, contiguas y del mismo tamaño.
 *
 * `endsOn` es el último día INCLUIDO. Quien llame decide si ese día es hoy o
 * `hoy − GSC_LAG_DAYS` (para Search Console lo segundo, porque los últimos días
 * están incompletos y compararlos contra días completos es una caída falsa).
 */
export function buildComparisonWindows(endsOn: Date, days: number = WINDOW_DAYS): ComparisonWindows {
  const currentEnd = endsOn;
  const currentStart = addDays(currentEnd, -(days - 1));
  const previousEnd = addDays(currentStart, -1);
  const previousStart = addDays(previousEnd, -(days - 1));

  return {
    current: { start: toDateKey(currentStart), end: toDateKey(currentEnd) },
    previous: { start: toDateKey(previousStart), end: toDateKey(previousEnd) },
    days,
  };
}

/** `true` si la clave `YYYY-MM-DD` cae dentro de la ventana (extremos incluidos). */
export function isWithin(window: DateWindow, dateKey: string): boolean {
  return dateKey >= window.start && dateKey <= window.end;
}

export interface Delta {
  current: number;
  previous: number;
  /** Diferencia absoluta. Siempre definida. */
  absolute: number;
  /**
   * Cambio relativo (0.25 = +25 %). `null` cuando el periodo anterior fue 0:
   * dividir entre cero daría `Infinity`, y presentar "+∞ %" o "+100 %" cuando
   * se pasa de 0 a 3 visitas es exactamente cómo un dashboard empieza a mentir.
   */
  relative: number | null;
  direction: "up" | "down" | "flat";
}

/** Compara dos valores de la misma métrica entre ventanas. */
export function delta(current: number, previous: number): Delta {
  const absolute = current - previous;
  const relative = previous === 0 ? null : absolute / previous;
  const direction: Delta["direction"] = absolute > 0 ? "up" : absolute < 0 ? "down" : "flat";
  return { current, previous, absolute, relative, direction };
}

/**
 * Formato humano del cambio relativo. Devuelve `—` cuando no hay base de
 * comparación, en vez de inventar un porcentaje.
 */
export function formatDelta(d: Delta): string {
  if (d.relative === null) return d.absolute === 0 ? "—" : `+${d.absolute}`;
  const pct = Math.round(d.relative * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}
