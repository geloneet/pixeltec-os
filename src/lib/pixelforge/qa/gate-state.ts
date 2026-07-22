/**
 * `computeQaGateState` — helper puro de la estación QA (PF-F8 T7, UI). No
 * existía un helper de gate-state antes de esta tarea (T4 abre/cierra la
 * compuerta directamente vía `openQaGate`/`finalizeQaRunOrchestrated`, sin
 * exponer una función pura que la UI pudiera reusar) — este módulo lo crea.
 *
 * Encapsula EXACTAMENTE la misma regla que ya aplica el backend (verbatim
 * del brief F8-T7, sección "Reglas de datos"): el gate hacia `revision` está
 * abierto si (verdict='pass' sobre la versión vigente) OR (human_decision=
 * 'approved' sobre un run cuya page_version es la vigente) — mismos dos
 * caminos que `finalizeQaRunOrchestrated` (verdict pass) y
 * `decision/route.ts` (approved) usan para invocar `openQaGate`. La UI
 * (`QaStationPanel`, `[id]/layout.tsx`) SOLO lee el resultado de acá; nunca
 * decide "¿está abierto?" por su cuenta ni recalcula verdict/score/decisión
 * — esos ya vienen resueltos en las columnas de cada `qa_run`.
 *
 * Sin DB, sin fecha del sistema, sin red — 100% puro y testeable en memoria.
 * `runs` debe venir YA ordenado desc por `createdAt` (mismo orden que
 * devuelve `listQaRunsForProject`, T1) — este módulo no mira fechas para no
 * cargar con parsing de `Date`/ISO indistinto entre el shape completo de
 * Drizzle (`Date`) y la vista serializada del panel (`string` ISO).
 */

export type QaGateRunStatus = "queued" | "running" | "succeeded" | "failed";
export type QaGateRunVerdict = "pass" | "pass_with_warnings" | "fail" | null;

/**
 * Forma mínima de un `qa_run` que este módulo necesita — cualquier fila más
 * grande (el `PixelforgeQaRun` completo de Drizzle, o la vista serializada
 * que arma `qa/page.tsx` para el panel) satisface esto igual por
 * estructura.
 */
export interface QaGateRunLike {
  id: string;
  pageVersionId: string;
  status: QaGateRunStatus;
  verdict: QaGateRunVerdict;
  /** `'approved' | 'rejected' | null` en la práctica — columna `text` sin enum en el schema. */
  humanDecision: string | null;
}

export type QaGateClosedReason =
  /** La versión vigente todavía no tiene ningún `qa_run` cerrado (y no hay temple obsoleto de otra versión). */
  | "no_qa"
  /** El `qa_run` cerrado de la vigente tiene `verdict='fail'`. */
  | "fail"
  /** `verdict='pass_with_warnings'` sobre la vigente, sin decisión humana todavía. */
  | "pending_decision"
  /** `verdict='pass_with_warnings'` sobre la vigente, decisión humana `rejected`. */
  | "rejected"
  /** El `qa_run` cerrado más reciente es de una versión distinta a la vigente — "temple obsoleto". */
  | "stale";

export interface QaGateState<Run extends QaGateRunLike = QaGateRunLike> {
  /** true si el gate hacia `revision` está abierto para la versión vigente. */
  open: boolean;
  /** Motivo del cierre — `null` cuando `open` es `true`. */
  reason: QaGateClosedReason | null;
  /**
   * El `qa_run` `succeeded` (con verdict resuelto) más reciente EN GENERAL,
   * de cualquier versión — `null` si el proyecto nunca cerró un QA. Es la
   * fuente del banner de "temple obsoleto".
   */
  latestClosedRun: Run | null;
  /**
   * El `qa_run` `succeeded` más reciente cuyo `pageVersionId` es la vigente
   * — `null` si la vigente todavía no tiene ningún QA cerrado. Es la fuente
   * del header "Temple" (verdict/score/categoryScores/humanDecision).
   */
  currentVersionRun: Run | null;
  /**
   * true si `latestClosedRun` existe pero es de una versión distinta a la
   * vigente (y por lo tanto no aporta al estado de la vigente). Siempre
   * `false` cuando `currentVersionRun` no es `null`.
   */
  obsolete: boolean;
}

/**
 * true si, siendo `run` el `qa_run` cerrado más reciente de LA VIGENTE
 * (responsabilidad del caller verificar eso), su verdict/decisión abrirían
 * el gate. Reusado por `computeQaGateState` (abajo) y por
 * `[id]/layout.tsx` para decidir si el segmento `qa` del riel debe leer
 * `invalidated` (un temple viejo que SÍ habría abierto el gate, pero la
 * vigente ya no tiene QA cerrado).
 */
export function wouldRunOpenGate(run: Pick<QaGateRunLike, "verdict" | "humanDecision">): boolean {
  if (run.verdict === "pass") return true;
  if (run.verdict === "pass_with_warnings" && run.humanDecision === "approved") return true;
  return false;
}

/**
 * Estado del gate para la versión vigente del proyecto. `runs` = todas las
 * corridas de QA del proyecto (`listQaRunsForProject`), desc por
 * `createdAt`. `currentPageVersionId` = id de la `page_version` vigente, o
 * `null` si el proyecto todavía no compuso ninguna (gate de entrada
 * `locked`, responsabilidad del caller — este helper igual responde algo
 * coherente: cerrado, sin QA).
 */
export function computeQaGateState<Run extends QaGateRunLike>(
  runs: readonly Run[],
  currentPageVersionId: string | null
): QaGateState<Run> {
  // Solo los `qa_run` cerrados con verdict resuelto cuentan como "temple" —
  // un `failed` (sin fase de navegador completa, p.ej.) nunca tiene verdict
  // y no puede abrir ni informar nada. `runs` ya viene desc por `createdAt`,
  // así que el primero de este filtro es el más reciente.
  const closed = runs.filter((r) => r.status === "succeeded" && r.verdict !== null);
  const latestClosedRun = closed[0] ?? null;

  if (!currentPageVersionId) {
    return { open: false, reason: "no_qa", latestClosedRun, currentVersionRun: null, obsolete: false };
  }

  const currentVersionRun = closed.find((r) => r.pageVersionId === currentPageVersionId) ?? null;

  if (!currentVersionRun) {
    const obsolete = latestClosedRun !== null;
    return {
      open: false,
      reason: obsolete ? "stale" : "no_qa",
      latestClosedRun,
      currentVersionRun: null,
      obsolete,
    };
  }

  if (wouldRunOpenGate(currentVersionRun)) {
    return { open: true, reason: null, latestClosedRun, currentVersionRun, obsolete: false };
  }
  if (currentVersionRun.verdict === "fail") {
    return { open: false, reason: "fail", latestClosedRun, currentVersionRun, obsolete: false };
  }
  // Lo único que sobrevive acá: verdict='pass_with_warnings' sin decisión que abra el gate.
  if (currentVersionRun.humanDecision === "rejected") {
    return { open: false, reason: "rejected", latestClosedRun, currentVersionRun, obsolete: false };
  }
  return { open: false, reason: "pending_decision", latestClosedRun, currentVersionRun, obsolete: false };
}

/**
 * Estado ADITIVO del segmento `qa` del riel de forja (`[id]/layout.tsx`):
 * `"sealed"` si el gate está abierto para la vigente, `"invalidated"` si hay
 * un temple que HABRÍA abierto el gate (pass, o pass_with_warnings
 * aprobado) pero es de una versión anterior y la vigente todavía no tiene
 * QA cerrado. `null` en cualquier otro caso — el caller debe conservar el
 * estado por defecto que ya calculaba (`STATION_ARTIFACT.qa === null` →
 * `"pending"`), este helper no lo reemplaza, solo indica cuándo hay que
 * sobreescribirlo.
 */
export function qaRailStatus(gate: QaGateState): "sealed" | "invalidated" | null {
  if (gate.open) return "sealed";
  if (gate.obsolete && !gate.currentVersionRun && gate.latestClosedRun && wouldRunOpenGate(gate.latestClosedRun)) {
    return "invalidated";
  }
  return null;
}
