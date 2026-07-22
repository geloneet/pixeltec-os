/**
 * `computeReviewStage` — helper puro de la estación de Revisión (PF-F9). Deriva
 * un único estado visible para la UI (y para cualquier consulta de estado)
 * combinando la compuerta de QA (`QaGateState`, `gate-state.ts`) con la
 * review activa o más reciente del proyecto.
 *
 * INVARIANTE que sostiene la regla 2 (`in_review` manda siempre): una review
 * solo puede estar `in_review` mientras su `pageVersionId` es la vigente —
 * `insertPageVersion` (repo, T3) supersede cualquier review `in_review` al
 * componer una nueva versión, así que si el caller encontró una `in_review`
 * es, por construcción, sobre la vigente. Este módulo no vuelve a verificar
 * `pageVersionId` para ese caso.
 *
 * Sin DB, sin fecha del sistema, sin red — 100% puro y testeable en memoria.
 * El caller (repo/query layer) resuelve `activeOrLatestReview` ANTES de
 * llamar: la review `in_review` si existe, si no la más reciente por
 * `roundNumber` descendente, o `null` si el proyecto nunca abrió una review.
 */
import type { QaGateState } from "@/lib/pixelforge/qa/gate-state";

export type ReviewStage =
  | "draft"
  | "awaiting_qa"
  | "qa_failed"
  | "ready_for_review"
  | "in_review"
  | "changes_requested"
  | "approved"
  | "superseded"
  | "cancelled";

/**
 * Forma mínima de una `pixelforge_review` que este módulo necesita —
 * cualquier fila más grande (el shape completo de Drizzle) satisface esto
 * igual por estructura.
 */
export interface ReviewLike {
  id: string;
  pageVersionId: string;
  status: "in_review" | "changes_requested" | "approved" | "superseded" | "cancelled";
}

/**
 * Estado derivado de la estación de Revisión para la versión vigente del
 * proyecto. Reglas, en orden (la primera que aplica gana):
 *
 * 1. `latestVersionId === null` → `draft` (todavía no se compuso ninguna
 *    landing; no hay nada que QA ni revisión puedan mirar).
 * 2. `activeOrLatestReview.status === "in_review"` → `in_review` (ver
 *    invariante arriba: solo existe sobre la vigente).
 * 3. Sin review relevante en este punto (ni `in_review`, ni terminal sobre
 *    la vigente) el estado lo deriva el gate de QA:
 *    - `gate.open` → `ready_for_review` (QA aprobó/pasó, listo para abrir
 *      una review).
 *    - `gate.reason === "fail"` → `qa_failed`.
 *    - resto (`no_qa`, `pending_decision`, `rejected`, `stale`) →
 *      `awaiting_qa`.
 * 4. Última review TERMINAL cuyo `pageVersionId` es la vigente:
 *    - `approved` → `approved`.
 *    - `changes_requested` → `changes_requested`.
 *    - `cancelled` / `superseded` → el ciclo sigue: cae a la regla 3 (el
 *      gate de QA decide, no la review cancelada/superseded).
 * 5. Review terminal de una versión ANTERIOR (`pageVersionId !==
 *    latestVersionId`, cualquier status): no informa el estado de la
 *    vigente — cae a la regla 3. `superseded` queda visible solo en el
 *    historial de rounds, nunca como stage vigente.
 */
export function computeReviewStage(
  gate: QaGateState,
  activeOrLatestReview: ReviewLike | null,
  latestVersionId: string | null
): ReviewStage {
  if (latestVersionId === null) return "draft";

  if (activeOrLatestReview?.status === "in_review") return "in_review";

  if (activeOrLatestReview && activeOrLatestReview.pageVersionId === latestVersionId) {
    if (activeOrLatestReview.status === "approved") return "approved";
    if (activeOrLatestReview.status === "changes_requested") return "changes_requested";
    // cancelled / superseded: el ciclo sigue, decide el gate (regla 3).
  }

  if (gate.open) return "ready_for_review";
  if (gate.reason === "fail") return "qa_failed";
  return "awaiting_qa";
}

/**
 * release-ready DERIVADO: la review debe estar `approved` Y anclada
 * EXACTAMENTE a la versión vigente — una aprobación de una versión anterior
 * no habilita el release aunque el status siga diciendo `approved` (ese
 * caso ya no debería ocurrir en la práctica porque una nueva `page_version`
 * supersede la review previa, pero esta función no confía en esa invariante
 * ajena y verifica el anclaje explícitamente).
 */
export function isReleaseReady(review: ReviewLike | null, latestVersionId: string | null): boolean {
  return review !== null && review.status === "approved" && review.pageVersionId === latestVersionId;
}
