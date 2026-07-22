/**
 * Hash canónico de un árbol de datos (`PixelforgeReview.snapshotTree` o
 * similar) — usado para anclar una review a un contenido exacto sin
 * depender de comparar objetos por igualdad profunda ni de re-serializar el
 * árbol completo en cada verificación.
 *
 * `canonicalJson` ordena las keys de cada objeto (recursivamente,
 * alfabéticamente por `Object.keys().sort()`) ANTES de serializar, para que
 * dos objetos con el mismo contenido pero distinto orden de inserción
 * produzcan el mismo string — JSON.stringify por sí solo preserva el orden
 * de inserción y rompería esa garantía. Los arrays SÍ conservan su orden: un
 * array es una secuencia con significado posicional, reordenarlo es un
 * cambio real de contenido (a diferencia de un objeto, donde el orden de
 * las keys es un accidente de construcción).
 *
 * `node:crypto` es aceptable en un módulo "puro": `createHash` es una
 * función determinista y sin estado (mismo input → mismo output, sin leer
 * reloj, red ni filesystem), no distinta en espíritu de usar `Array.sort`.
 */
import { createHash } from "node:crypto";

export const TREE_HASH_ALGORITHM = "sha256";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
    const out: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      out[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** Serialización canónica: keys de objetos ordenadas recursivamente (arrays conservan orden). */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

/** Devuelve `sha256:<hex64>` sobre `canonicalJson(tree)`. */
export function computeTreeHash(tree: unknown): string {
  const hex = createHash(TREE_HASH_ALGORITHM).update(canonicalJson(tree)).digest("hex");
  return `${TREE_HASH_ALGORITHM}:${hex}`;
}

/**
 * true si `stored` coincide con `computeTreeHash(tree)`. Tolera SOLO el
 * formato con prefijo (`sha256:<hex>`) — un hash "pelado" (sin prefijo),
 * aunque coincida en el hex, se considera no-match: el prefijo es parte del
 * contrato de almacenamiento, no un detalle cosmético.
 */
export function treeHashMatches(tree: unknown, stored: string): boolean {
  return stored.startsWith(`${TREE_HASH_ALGORITHM}:`) && stored === computeTreeHash(tree);
}
