/**
 * Separación de consultas de marca (WO-2026-00214).
 *
 * Por qué importa: quien busca "pixeltec" ya nos conoce y hace clic casi
 * siempre. Mezclar esas consultas con las genéricas infla el CTR global y
 * hunde la posición media de todo lo demás, así que el número resultante no
 * dice nada sobre si el contenido capta demanda NUEVA — que es justo la
 * pregunta que el módulo existe para responder.
 */

import { BRAND_QUERY_REGEX } from "./config";

/** `true` si la consulta menciona la marca en cualquiera de sus variantes de tecleo. */
export function isBrandQuery(query: string): boolean {
  return BRAND_QUERY_REGEX.test((query ?? "").trim());
}

export interface QueryRow {
  query: string;
  clicks: number;
  impressions: number;
}

export interface BrandSplit<T extends QueryRow> {
  brand: T[];
  generic: T[];
}

/** Parte una lista de consultas en marca / genéricas, conservando el orden. */
export function splitBrandQueries<T extends QueryRow>(rows: readonly T[]): BrandSplit<T> {
  const brand: T[] = [];
  const generic: T[] = [];
  for (const row of rows) {
    (isBrandQuery(row.query) ? brand : generic).push(row);
  }
  return { brand, generic };
}

/**
 * Proporción de clics que vienen de marca, entre 0 y 1. `null` cuando no hay
 * clics: un 0 % aquí significaría "nadie llega por marca", y eso es distinto de
 * "todavía no hay datos".
 */
export function brandClickShare(rows: readonly QueryRow[]): number | null {
  const total = rows.reduce((sum, r) => sum + r.clicks, 0);
  if (total === 0) return null;
  const brand = rows.filter((r) => isBrandQuery(r.query)).reduce((sum, r) => sum + r.clicks, 0);
  return brand / total;
}
