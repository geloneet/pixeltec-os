/**
 * `finalizeQaRunOrchestrated` — cierre idempotente de un qa_run (PF-F8 T4).
 *
 * Server-only (importa el repo, que abre conexiones a DB) — NO se importa
 * desde código cliente. Invocable múltiples veces sobre el MISMO `qaRunId`
 * sin efectos duplicados: cada invocación recarga el estado fresco desde DB
 * y el repo (`finalizeQaRun`/`failQaRun`) garantiza que solo UN invocador
 * gana el cierre real (`UPDATE ... WHERE status='running'`, 0 filas
 * afectadas para el resto). Quién la llama:
 *  - `GET /api/pixelforge/qa/runs/:qaRunId` — "lazy finalize": si el run
 *    sigue `running`, intenta cerrarlo antes de responder (así el poller del
 *    cliente eventualmente ve el cierre sin necesitar un cron aparte).
 *  - El runner de navegador (F8-T6, no existe todavía) y las corridas
 *    advisory (F8-T5, no existen todavía) la invocarán al terminar su fase.
 *
 * Condición de cierre (verbatim del plan): `browser_status` terminal
 * (`succeeded|failed|timed_out|skipped`) Y fase advisory resuelta —
 * (los 3 FK de `ai_runs` seteados y esas 3 corridas terminales) O (ningún FK
 * seteado, la fase advisory nunca se lanzó) O (`createdAt` de hace más de 5
 * minutos, watchdog: no esperar para siempre una fase advisory que se colgó).
 * Sin T5 (hoy: `launchQaAdvisoryRuns` es un stub que nunca setea los FKs), la
 * fase advisory SIEMPRE cuenta como resuelta de inmediato —
 * `advisoryIncomplete` en el resumen queda `false` (no se intentó, no que
 * "se intentó y no terminó").
 *
 * Si `browser_status` es `failed`/`timed_out`, el run se cierra `failed` (vía
 * `failQaRun`, SIN veredicto — el plan es explícito: jamás un PASS parcial
 * sin la fase de navegador completa). Si es `succeeded`/`skipped`, se computa
 * el veredicto (`computeQaScore`, T2) y se cierra `succeeded` (vía
 * `finalizeQaRun`); si el veredicto es `pass` Y este invocador ganó el
 * cierre Y la versión evaluada SIGUE siendo la vigente del proyecto, se abre
 * la compuerta (`openQaGate`) hacia `revision`.
 *
 * Restricción del plan: "el gate solo honra QA de la versión vigente". La
 * ruta de decisión humana (`decision/route.ts`) ya la aplica devolviendo 409
 * si `getLatestPageVersion(...).id !== run.pageVersionId`. Este camino
 * automático reusa el `latestVersionNumber` que YA se cargó para el finding
 * QA-ST-004 (mismo dato, comparación numérica `pageVersion.version ===
 * latestVersionNumber` en vez de por id — equivalente para este propósito,
 * evita una segunda consulta) — si el QA evaluó v3 y la vigente pasó a ser
 * v4 mientras corría, el run cierra igual (verdict/score intactos) pero el
 * gate se omite; se deja rastro barato en el resumen
 * (`gateSkippedStaleVersion: true`) solo en ese caso, para no inflar el JSON
 * persistido en el caso mayoritario (pass + versión vigente).
 *
 * `treeUsesCapabilities`/`checksSkipped` de fase 1 (que corrió in-process en
 * el POST, potencialmente en un request HTTP totalmente distinto al que
 * ejecuta este cierre) NO se persisten en ninguna columna nueva — se
 * RECALCULAN barato acá, volviendo a llamar `runDeterministicChecks` (T2,
 * función pura) sobre la MISMA versión de página evaluada y la dirección
 * `chosen` ACTUAL del proyecto. Se descartan sus `findings` (ya están
 * persistidos desde la fase 1 — recalcularlos de nuevo sería redundante, el
 * dedupe de `insertQaFindings` los volvería no-op de todas formas); solo se
 * usan `checksSkipped`/`treeUsesCapabilities`. Nota: si el usuario cambia la
 * dirección elegida del proyecto MIENTRAS un QA está en curso (ventana
 * angosta, sin lock), este recompute puede ver una dirección distinta a la
 * que vio la fase 1 — no afecta el veredicto/score real (ya persistidos),
 * solo la metadata informativa (`checksSkipped`) del resumen. Alternativa
 * descartada: exponer estos 2 campos en `DeterministicChecksResult` y
 * persistirlos en una columna nueva de `qa_runs` — más fiel, pero exige
 * migración; se eligió recalcular por ser aditivo y no tocar el schema.
 */
import {
  getQaRunById,
  getAiRunStatuses,
  getPageVersionInternal,
  getLatestPageVersionNumber,
  getChosenDirectionForProject,
  getQaFindingsForRun,
  insertQaFindings,
  finalizeQaRun,
  failQaRun,
  openQaGate,
} from "@/lib/db/repos/pixelforge";
import { runDeterministicChecks } from "./run-deterministic";
import { buildStaleVersionFinding } from "./checks/structural";
import { computeQaScore, type QaScoreInput } from "./scoring";
import { QA_CHECKS } from "./catalog";

/** Fase de navegador (`browser_status`) terminal — no queda nada más que esperar de esa fase. */
const BROWSER_TERMINAL_STATUSES = ["succeeded", "failed", "timed_out", "skipped"] as const;

/** Watchdog: no esperar la fase advisory más de 5 minutos desde que arrancó el run entero. */
const ADVISORY_WAIT_TIMEOUT_MS = 5 * 60 * 1000;

/** Resumen persistido en `qa_runs.summary` (jsonb) al cerrar `succeeded`. */
export interface QaRunSummary {
  severityCounts: { critical: number; major: number; minor: number; info: number };
  /** `true` solo si la fase advisory se lanzó (algún FK seteado) pero no llegó a terminar antes del watchdog de 5 min. `false` si nunca se lanzó (T5 no existe todavía) o si terminó a tiempo. */
  advisoryIncomplete: boolean;
  /** Códigos de check no evaluados: los que la fase 1 saltó (árbol inválido / sin dirección / designTokens malformados) + TODOS los códigos `nav` si `browser_status==='skipped'`. */
  checksSkipped: string[];
  /**
   * `true` únicamente cuando el veredicto fue `pass` pero la versión
   * evaluada dejó de ser la vigente antes de este cierre (carrera con una
   * edición/nueva versión mientras el QA corría) — el gate NO se abrió a
   * pesar del pass. Ausente (`undefined`) en cualquier otro caso: no se
   * persiste `false` explícito para no inflar el JSON en el caso mayoritario
   * (pass con versión vigente, o cualquier verdict distinto de `pass`).
   */
  gateSkippedStaleVersion?: boolean;
}

export async function finalizeQaRunOrchestrated(qaRunId: string): Promise<void> {
  try {
    const run = await getQaRunById(qaRunId);
    if (!run || run.status !== "running") return; // no-op: ya cerrado, o no existe.

    const advisoryRunIds = [run.critiqueRunId, run.originalityRunId, run.likenessRunId].filter(
      (id): id is string => id !== null
    );
    const advisoryLaunched = advisoryRunIds.length > 0;

    let advisoryAllTerminal = true;
    if (advisoryLaunched) {
      const statuses = await getAiRunStatuses(advisoryRunIds);
      advisoryAllTerminal = advisoryRunIds.every((id) => {
        const status = statuses.get(id);
        return status === "succeeded" || status === "failed";
      });
    }
    const advisoryTimedOut = Date.now() - run.createdAt.getTime() > ADVISORY_WAIT_TIMEOUT_MS;
    const advisoryResolved = !advisoryLaunched || advisoryAllTerminal || advisoryTimedOut;
    const advisoryIncomplete = advisoryLaunched && !advisoryAllTerminal;

    const browserTerminal = (BROWSER_TERMINAL_STATUSES as readonly string[]).includes(run.browserStatus);
    if (!browserTerminal || !advisoryResolved) return; // sigue en curso — nada que cerrar todavía.

    if (run.browserStatus === "failed" || run.browserStatus === "timed_out") {
      await failQaRun(
        qaRunId,
        run.browserStatus === "timed_out" ? "timeout" : "runner_error",
        `La fase de navegador terminó en estado "${run.browserStatus}"`
      );
      return;
    }

    // browser_status ∈ {succeeded, skipped} — computar veredicto y cerrar.
    const pageVersion = await getPageVersionInternal(run.pageVersionId);
    if (!pageVersion) {
      await failQaRun(qaRunId, "internal", "La versión de página evaluada ya no existe");
      return;
    }

    const latestVersionNumber = await getLatestPageVersionNumber(run.projectId);
    const staleFinding = buildStaleVersionFinding(pageVersion.version, latestVersionNumber ?? pageVersion.version);
    if (staleFinding) {
      await insertQaFindings(qaRunId, [staleFinding]);
    }
    // Mismo dato ya cargado arriba para ST-004, reusado acá para decidir el
    // gate (ver docstring del módulo): `latestVersionNumber === null` (no
    // debería pasar — implica que el proyecto no tiene NINGUNA versión, pero
    // el run que estamos cerrando referencia una — se trata como "no stale"
    // para no bloquear el gate por un dato ausente/anómalo, igual que hace
    // `buildStaleVersionFinding` con el `?? pageVersion.version` de arriba).
    const isStaleVersion = latestVersionNumber !== null && latestVersionNumber !== pageVersion.version;

    const chosenDirection = await getChosenDirectionForProject(run.projectId);
    const recompute = runDeterministicChecks({
      tree: pageVersion.tree,
      chosenDirection: chosenDirection ? { designTokens: chosenDirection.designTokens, status: chosenDirection.status } : null,
      motionDna: chosenDirection?.motionDna,
    });

    const dbFindings = await getQaFindingsForRun(qaRunId);

    const scoreInput: QaScoreInput = {
      findings: dbFindings.map((finding) => ({
        checkCode: finding.checkCode,
        category: finding.category,
        severity: finding.severity,
        blocking: finding.blocking,
      })),
      treeUsesCapabilities: recompute.treeUsesCapabilities,
      phasesComplete: { deterministic: true, browser: run.browserStatus === "succeeded" },
    };
    const scoreResult = computeQaScore(scoreInput);

    const severityCounts = { critical: 0, major: 0, minor: 0, info: 0 };
    for (const finding of dbFindings) severityCounts[finding.severity] += 1;

    const checksSkipped = [...recompute.checksSkipped];
    if (run.browserStatus === "skipped") {
      checksSkipped.push(...QA_CHECKS.filter((check) => check.checkClass === "nav").map((check) => check.code));
    }

    const summary: QaRunSummary = { severityCounts, advisoryIncomplete, checksSkipped };
    if (scoreResult.verdict === "pass" && isStaleVersion) {
      summary.gateSkippedStaleVersion = true;
    }

    const closed = await finalizeQaRun(qaRunId, {
      verdict: scoreResult.verdict,
      scoreTotal: scoreResult.scoreTotal,
      categoryScores: scoreResult.categoryScores,
      summary,
    });

    if (closed && scoreResult.verdict === "pass" && !isStaleVersion) {
      await openQaGate(run.projectId, qaRunId, { id: run.requestedById, name: run.requestedByName });
    }
  } catch (err) {
    console.error("[pixelforge/qa finalize]", err);
    // Nunca dejar el run colgado — mismo criterio de "best-effort de cierre"
    // que el catch de `runs/route.ts` (F2, decisión I1).
    try {
      await failQaRun(qaRunId, "internal", err instanceof Error ? err.message : "Error inesperado");
    } catch {}
  }
}
