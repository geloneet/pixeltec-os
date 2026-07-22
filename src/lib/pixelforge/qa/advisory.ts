/**
 * `launchQaAdvisoryRuns` — fase IA advisory de un qa_run (PF-F8 T5).
 *
 * Lanza las 3 operaciones IA advisory (`critique_design`/`score_originality`/
 * `detect_ai_likeness` — checks QA-IA-001/002/003 del catálogo,
 * `qa/advisory-operations.ts`) atadas al `qa_run` que la invoca. REGLA DE ORO
 * del plan maestro F8: esta fase es ADVISORY — peso 0 en el score, jamás
 * bloquea; el catálogo/scoring de T2 ya lo garantizan, este módulo no lo
 * duplica.
 *
 * Idempotente: si CUALQUIER FK advisory del qa_run ya está seteado (releído
 * fresco vía `attachQaAdvisoryRuns`, no un valor visto antes), no-op —
 * `{launched:false, reason:'already-launched'}`. Evita doble lanzamiento si
 * el caller (la fase 1 del POST, `src/app/api/pixelforge/qa/runs/route.ts`)
 * se invocara dos veces por un reintento.
 *
 * Atomicidad de los 3 FKs: `attachQaAdvisoryRuns` (repo, F8-T5) crea los 3
 * `ai_runs` (`queued`) Y setea los 3 FKs del qa_run EN UNA MISMA transacción
 * — o los 3 quedan seteados, o ninguno (si la transacción falla, no queda un
 * estado a medias). Esta función NUNCA implementa su propio fallback
 * parcial: confía en que `attachQaAdvisoryRuns` devuelve o los 3 ids, o
 * `null` — nada intermedio.
 *
 * Actor de los 3 `ai_runs`: el actor del qa_run (`requestedById`/
 * `requestedByName`) — la misma persona que arrancó el QA (en la práctica,
 * el `ownerId` del proyecto: `qa/runs/route.ts` los crea idénticos). Si
 * `requestedById` es `null` (usuario borrado, `onDelete: set null`), no se
 * puede resolver un `ownerId` válido para cargar el proyecto — se trata como
 * "no lanzada" en vez de lanzar una excepción que tumbaría la fase 1 entera
 * del POST (que sigue corriendo determinista+heurística en el mismo bloque
 * try/catch); `finalizeQaRunOrchestrated` ya interpreta "ningún FK seteado"
 * como "fase advisory nunca lanzada, no hay que esperarla" (ver su
 * docstring), así que el qa_run cierra igual sin quedar colgado.
 *
 * Fallo al disparar una de las 3 ejecuciones (guard, buildRequest, el modelo,
 * validación de dominio) → su `ai_run` termina `failed` por la taxonomía
 * normal del motor (`ai/run.ts`/`ai/failures.ts`); el cierre de T4
 * (`finalizeQaRunOrchestrated`) lo trata como terminal
 * (`advisoryIncomplete` se calcula sobre estados terminales
 * `succeeded|failed`, ver su docstring) — nunca deja el qa_run esperando un
 * `ai_run` que nunca va a resolver.
 *
 * Orden de cierre (ver brief): primero `finishRunRecord` del `ai_run`,
 * DESPUÉS `finalizeQaRunOrchestrated(qaRunId)` — SIEMPRE, incluso si la
 * operación falló (puede ser el último FK en llegar a estado terminal, el
 * único invocador que dispara el cierre real del qa_run).
 */
import {
  getQaRunById,
  getPixelforgeProjectFull,
  attachQaAdvisoryRuns,
  claimRun,
  finishRunRecord,
  updateRunProgress,
  type Actor,
  type FinishRunResult,
  type PixelforgeProjectFull,
} from "@/lib/db/repos/pixelforge";
import { executeOperation } from "../ai/run";
import { getPixelforgeAnthropic, resolvePixelForgeModel } from "../ai/client";
import { finalizeQaRunOrchestrated } from "./finalize";
import {
  critiqueDesignOperation,
  scoreOriginalityOperation,
  detectAiLikenessOperation,
  loadAdvisoryContext,
  type AdvisoryOperationCtx,
} from "./advisory-operations";
import type { PixelforgeAIOperation } from "../schemas";

export interface LaunchQaAdvisoryRunsInput {
  qaRunId: string;
  projectId: string;
}

export type LaunchQaAdvisoryRunsReason =
  | "already-launched"
  | "qa-run-not-found"
  | "missing-actor"
  | "project-not-found";

export interface LaunchQaAdvisoryRunsResult {
  launched: boolean;
  reason?: LaunchQaAdvisoryRunsReason;
}

/** Las 3 operaciones advisory — orden estable, usado tanto para el seed de `attachQaAdvisoryRuns` como para el fire-and-forget de cada una. */
const ADVISORY_CONFIGS = [
  { operation: "critique_design" as const, config: critiqueDesignOperation },
  { operation: "score_originality" as const, config: scoreOriginalityOperation },
  { operation: "detect_ai_likeness" as const, config: detectAiLikenessOperation },
];

export async function launchQaAdvisoryRuns(
  input: LaunchQaAdvisoryRunsInput
): Promise<LaunchQaAdvisoryRunsResult> {
  const { qaRunId, projectId } = input;

  const qaRun = await getQaRunById(qaRunId);
  if (!qaRun) return { launched: false, reason: "qa-run-not-found" };
  if (qaRun.critiqueRunId !== null || qaRun.originalityRunId !== null || qaRun.likenessRunId !== null) {
    return { launched: false, reason: "already-launched" };
  }
  if (!qaRun.requestedById) return { launched: false, reason: "missing-actor" };

  const ownerId = qaRun.requestedById;
  const actor: Actor = { id: ownerId, name: qaRun.requestedByName };

  const full = await getPixelforgeProjectFull(projectId, ownerId);
  if (!full) return { launched: false, reason: "project-not-found" };

  const ctx: AdvisoryOperationCtx = { ownerId, qaRunId };
  const extra = await loadAdvisoryContext(full, ctx);

  const attached = await attachQaAdvisoryRuns(qaRunId, {
    projectId,
    actor,
    critique: {
      operation: "critique_design",
      model: resolvePixelForgeModel("critique_design"),
      promptVersion: critiqueDesignOperation.promptVersion,
      inputSummary: critiqueDesignOperation.inputSummary(full, ctx, extra),
    },
    originality: {
      operation: "score_originality",
      model: resolvePixelForgeModel("score_originality"),
      promptVersion: scoreOriginalityOperation.promptVersion,
      inputSummary: scoreOriginalityOperation.inputSummary(full, ctx, extra),
    },
    likeness: {
      operation: "detect_ai_likeness",
      model: resolvePixelForgeModel("detect_ai_likeness"),
      promptVersion: detectAiLikenessOperation.promptVersion,
      inputSummary: detectAiLikenessOperation.inputSummary(full, ctx, extra),
    },
  });

  // Atomicidad (ver docstring): o los 3 FKs quedaron seteados, o ninguno —
  // esta función nunca intenta reconciliar un estado intermedio.
  if (!attached) return { launched: false, reason: "already-launched" };

  const runIdByOperation: Record<PixelforgeAIOperation, string> = {
    critique_design: attached.critiqueRunId,
    score_originality: attached.originalityRunId,
    detect_ai_likeness: attached.likenessRunId,
  } as Record<PixelforgeAIOperation, string>;

  for (const { operation, config } of ADVISORY_CONFIGS) {
    const runId = runIdByOperation[operation];
    // Fire-and-forget: cada una corre independiente — el fallo de una no
    // afecta a las otras 2 (mismo criterio de aislamiento que `runs/route.ts`).
    void runAdvisoryOperation({ runId, operation, config, full, ctx, actor, qaRunId });
  }

  return { launched: true };
}

interface RunAdvisoryOperationParams {
  runId: string;
  operation: PixelforgeAIOperation;
  config: typeof critiqueDesignOperation | typeof scoreOriginalityOperation | typeof detectAiLikenessOperation;
  full: PixelforgeProjectFull;
  ctx: AdvisoryOperationCtx;
  actor: Actor;
  qaRunId: string;
}

/** Cierra el `ai_run` y SIEMPRE intenta el cierre del `qa_run` completo — ver docstring del módulo (orden: primero finishRun, después finalize). */
async function finishAndFinalize(runId: string, qaRunId: string, result: FinishRunResult): Promise<void> {
  await finishRunRecord(runId, result);
  await finalizeQaRunOrchestrated(qaRunId);
}

async function runAdvisoryOperation(params: RunAdvisoryOperationParams): Promise<void> {
  const { runId, operation, config, full, ctx, actor, qaRunId } = params;

  try {
    const claimed = await claimRun(runId);
    if (!claimed) return; // defensivo — recién creado en `queued`, no debería pasar.

    // `ctx` con `runId` (BUG-1 smoke F8): `attachQaAdvisoryRuns` ya seteó el FK advisory
    // de esta operación al `runId` que se está ejecutando ANTES de llegar acá — el guard
    // necesita saber cuál es ese `runId` para distinguir "el FK apunta a este run" (acepta)
    // de "el FK apunta a otro run" (rechaza, duplicado). El `ctx` externo del scope de
    // `launchQaAdvisoryRuns` no lo lleva (se arma antes de que exista ningún `runId`), así
    // que se arma acá, local a esta operación.
    const runCtx: AdvisoryOperationCtx = { ...ctx, runId };

    // Re-carga fresca (mismo criterio que al calcular el `inputSummary` de arriba, pero justo antes de
    // ejecutar — defensa contra una carrera donde el qa_run cambió de estado entre `attachQaAdvisoryRuns`
    // y este punto, p.ej. `sweepStaleQaRuns` lo marcó `failed` mientras esto esperaba en la cola de eventos).
    const extra = await config.loadExtra(full, runCtx);
    const guardError = config.guard(full, runCtx, extra);
    if (guardError) {
      await finishAndFinalize(runId, qaRunId, {
        status: "failed",
        failureKind: "provider_error",
        error: guardError,
        durationMs: 0,
        retryCount: 0,
      });
      return;
    }

    const { system, messages } = config.buildRequest(full, runCtx, extra);

    // Variable intermedia (no un literal inline) a propósito: `persistResult` de las 3 operaciones
    // acepta `AdvisoryOperationCtx` (solo lo que usan), pero el chequeo de excess properties de TS
    // rechazaría un objeto LITERAL con `projectId`/`actor` de más — pasando por una `const`
    // ya tipada eso deja de aplicar (mismo objeto en runtime, solo evita el chequeo de literal fresco).
    // Parte de `runCtx` (ya trae `runId`) en vez de `ctx` — mismo `runId` que vio el guard.
    const persistCtx: AdvisoryOperationCtx & { projectId: string; actor: Actor; runId: string } = {
      ...runCtx,
      runId,
      projectId: full.project.id,
      actor,
    };

    await executeOperation({
      client: getPixelforgeAnthropic(),
      operation,
      system,
      messages,
      domainSchema: config.domainSchema,
      callbacks: {
        onProgress: (progress, currentStep) => updateRunProgress(runId, progress, currentStep),
        persistResult: (output) => config.persistResult(output, persistCtx),
        finishRun: (result) => finishAndFinalize(runId, qaRunId, result),
      },
    });
  } catch (err) {
    console.error("[pixelforge/qa advisory]", err);
    try {
      await finishAndFinalize(runId, qaRunId, {
        status: "failed",
        failureKind: "provider_error",
        error: err instanceof Error ? err.message : "Error inesperado",
        durationMs: 0,
        retryCount: 0,
      });
    } catch {}
  }
}
