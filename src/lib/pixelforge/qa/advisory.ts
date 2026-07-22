/**
 * `launchQaAdvisoryRuns` — fase IA advisory de un qa_run (PF-F8).
 *
 * STUB para T4: las 3 operaciones advisory (`critique_design`,
 * `score_originality`, `detect_ai_likeness` — checks QA-IA-001/002/003 del
 * catálogo) todavía NO están en `ENABLED_OPERATIONS`
 * (`src/app/api/pixelforge/runs/route.ts`) — T5 las agrega ahí y reemplaza
 * este cuerpo por las 3 llamadas reales a `createRun`/`claimRun` (dejando los
 * FKs `critiqueRunId`/`originalityRunId`/`likenessRunId` de la corrida de QA
 * seteados). Hasta entonces, este stub SIEMPRE devuelve `{ launched: false }`
 * y no toca la DB — los 3 FKs de la corrida de QA quedan `null` para
 * siempre, lo cual el cierre (`finalize.ts`) ya interpreta correctamente como
 * "fase advisory nunca lanzada, no hay que esperarla" (ver su docstring).
 *
 * Firma estable a propósito: el POST (`src/app/api/pixelforge/qa/runs/route.ts`)
 * ya la invoca con la forma final esperada, así que T5 solo necesita
 * reemplazar el cuerpo de esta función — el wiring del caller no cambia.
 */

export interface LaunchQaAdvisoryRunsInput {
  qaRunId: string;
  projectId: string;
}

export interface LaunchQaAdvisoryRunsResult {
  launched: boolean;
}

export async function launchQaAdvisoryRuns(
  input: LaunchQaAdvisoryRunsInput
): Promise<LaunchQaAdvisoryRunsResult> {
  void input;
  return { launched: false };
}
