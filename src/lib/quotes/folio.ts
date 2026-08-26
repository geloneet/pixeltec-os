/**
 * Folio de cotización (WO-2026-00101). Módulo puro para poder testear el
 * formato y el avance sin base de datos.
 *
 * Formato: `COT-<año>-<consecutivo de 4 dígitos>`. El consecutivo es por año:
 * en enero vuelve a 0001, como cualquier talonario.
 */

export const FOLIO_RE = /^COT-(\d{4})-(\d{4,})$/;

/** Construye el folio a partir del año y el consecutivo. */
export function buildFolio(year: number, sequence: number): string {
  return `COT-${year}-${String(sequence).padStart(4, '0')}`;
}

/** Lee un folio; `null` si no tiene la forma esperada. */
export function parseFolio(folio: string): { year: number; sequence: number } | null {
  const match = FOLIO_RE.exec(folio.trim());
  if (!match) return null;
  return { year: Number(match[1]), sequence: Number(match[2]) };
}

/**
 * Siguiente folio dado el año en curso y los folios ya usados.
 * Ignora los de otros años y los que no tengan el formato — un folio ilegible
 * heredado no puede bloquear la creación de la siguiente cotización.
 */
export function nextFolio(year: number, existing: readonly string[]): string {
  const highest = existing.reduce((max, raw) => {
    const parsed = parseFolio(raw);
    if (!parsed || parsed.year !== year) return max;
    return Math.max(max, parsed.sequence);
  }, 0);
  return buildFolio(year, highest + 1);
}
