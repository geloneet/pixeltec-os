/**
 * Parser puro del valor objetivo de count-up (QA-MO-003, T6) — MISMA forma
 * que el parser interno (no exportado) de `MotionSection.tsx`
 * (`parseCountTarget`/`formatCount`), duplicado deliberadamente aquí: ese
 * módulo es `"use client"` y sus helpers no se exportan (son detalle interno
 * de la animación) — el runner necesita su propia copia puro-Node, sin tirar
 * de React/framer-motion al proceso del qa-runner. Cualquier cambio de
 * formato en `MotionSection.tsx` debe reflejarse acá también (documentado en
 * ambos archivos).
 *
 * Uso real del check: el DOM ya deja en `data-pf-motion-count` el mismo texto
 * crudo que `StatsBand`/etc. renderiza como `textContent` inicial (ver
 * `StatsBand.tsx`: `<span data-pf-motion-count={stat.valor}>{stat.valor}</span>`)
 * — tras el settle (T6, MOTION_SETTLE_MS), el `textContent` final debe volver
 * a coincidir con ese mismo valor exacto (`onComplete` de `MotionSection`
 * restaura `parsed.raw`, no un recálculo). `countSettledAtTarget` compara
 * ambos strings pasando por el parser (en vez de una comparación de string
 * plana) para tolerar diferencias triviales de espacios en blanco que no
 * deberían contar como "count-up congelado".
 */

export interface ParsedCountTarget {
  /** Texto crudo original — el valor exacto que debe quedar al terminar. */
  raw: string;
  prefix: string;
  suffix: string;
  target: number;
  decimals: number;
  grouped: boolean;
}

/** Parsea "120+", "98%", "1,250", etc. `null` si no contiene ninguna cifra (texto no numérico). */
export function parseCountTarget(raw: string): ParsedCountTarget | null {
  const match = raw.match(/^([^\d]*)([\d.,]+)(.*)$/);
  if (!match) return null;
  const [, prefix, numStr, suffix] = match;
  const target = Number.parseFloat(numStr.replace(/,/g, ""));
  if (!Number.isFinite(target)) return null;
  const decimals = numStr.includes(".") ? (numStr.split(".")[1]?.length ?? 0) : 0;
  return { raw, prefix, suffix, target, decimals, grouped: numStr.includes(",") };
}

/** Formatea `value` con los mismos decimales/agrupado que `parsed` — espejo de `formatCount` en `MotionSection.tsx`. */
export function formatCount(value: number, parsed: ParsedCountTarget): string {
  const fixed = value.toFixed(parsed.decimals);
  if (!parsed.grouped) return fixed;
  const [intPart, decPart] = fixed.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${grouped}.${decPart}` : grouped;
}

/**
 * `true` si `displayedText` (textContent leído del DOM tras el settle) quedó
 * EXACTAMENTE en el valor objetivo que codifica `rawAttr`
 * (`data-pf-motion-count`). Sin cifras parseables en `rawAttr` (texto no
 * numérico) cae a comparación de string plana — mismo criterio que
 * `MotionSection`, que en ese caso nunca toca el `textContent` server.
 */
export function countSettledAtTarget(displayedText: string, rawAttr: string): boolean {
  const parsed = parseCountTarget(rawAttr);
  if (!parsed) return displayedText.trim() === rawAttr.trim();
  const expected = parsed.prefix + formatCount(parsed.target, parsed) + parsed.suffix;
  return displayedText.trim() === expected.trim();
}
