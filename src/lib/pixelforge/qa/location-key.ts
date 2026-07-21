/**
 * `buildLocationKey` — clave determinista de "dónde" ocurrió un hallazgo de
 * QA dentro de una versión de landing. Es la mitad derecha del unique de
 * dedupe `(qa_run_id, check_code, location_key)` (T1,
 * `src/lib/db/repos/pixelforge.ts` — `insertQaFindings`): dos ejecuciones del
 * mismo check sobre el mismo lugar deben producir la MISMA `locationKey` para
 * que el `onConflictDoNothing` realmente deduplique.
 *
 * Módulo puro — sin DB, sin fecha, sin red. `checkCode` ya identifica QUÉ
 * check disparó (va también en su propia columna); esta clave solo captura
 * DÓNDE, con el formato fijo:
 *
 *   "<checkCode>|<nodeId|->|<viewport|->|<slot-o-selectorHash|->"
 *
 * Los 3 campos de ubicación son opcionales de forma independiente — cada uno
 * ausente se serializa como `"-"` literal (nunca `undefined`/`""`) para que
 * la clave sea siempre un string plano y estable. El cuarto segmento prioriza
 * `slot` sobre `selectorHash` cuando ambos vienen presentes (un check
 * determinista/heurístico casi siempre conoce el `slot` de un nodo ya
 * validado; `selectorHash` es la variante que usará el runner de navegador —
 * T6 — para checks que no mapean a un slot semántico, p.ej. overflow de un
 * elemento arbitrario del DOM).
 */

/** Ubicación de un hallazgo — todos los campos opcionales, cada ausencia se serializa como `"-"`. */
export interface QaFindingLocation {
  /** `nodeId` del árbol validado (`ValidatedPageNode.nodeId`) donde ocurrió el hallazgo. */
  nodeId?: string;
  /** Viewport de navegador en el que se detectó (checks `nav` — T6). Ausente en checks `det`/`heu` server-side. */
  viewport?: string;
  /** Slot/campo semántico dentro del nodo (p.ej. `"titulo"`, `"cta.label"`). */
  slot?: string;
  /** Hash estable de un selector CSS/DOM arbitrario — alternativa a `slot` para hallazgos de navegador sin slot semántico. */
  selectorHash?: string;
}

const EMPTY_SEGMENT = "-";

function segment(value: string | undefined): string {
  return value && value.length > 0 ? value : EMPTY_SEGMENT;
}

/**
 * Construye la `locationKey` determinista para un `checkCode` + ubicación.
 * `location` ausente (o con todos los campos ausentes) produce
 * `"<checkCode>|-|-|-"` — válido para hallazgos de alcance global (p.ej. un
 * error de `validatePageTree` que no apunta a un nodo concreto).
 */
export function buildLocationKey(checkCode: string, location?: QaFindingLocation | null): string {
  const nodeId = segment(location?.nodeId);
  const viewport = segment(location?.viewport);
  const slotOrSelectorHash = segment(location?.slot ?? location?.selectorHash);

  return `${checkCode}|${nodeId}|${viewport}|${slotOrSelectorHash}`;
}
