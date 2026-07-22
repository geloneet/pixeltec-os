/**
 * Hash determinista de un selector CSS/DOM arbitrario (QA-AX-001, QA-TE-005,
 * T6) — alimenta `QaFindingLocation.selectorHash` (`qa/location-key.ts`)
 * cuando un hallazgo de navegador no mapea a un `slot` semántico. FNV-1a
 * 32-bit: determinista entre procesos/corridas (sin `Math.random`, sin
 * dependencia de una lib de hash externa), suficiente para dedupe de
 * ubicación — NO es criptográfico ni necesita serlo.
 */
export function hashSelector(selector: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < selector.length; i++) {
    hash ^= selector.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
