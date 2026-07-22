#!/usr/bin/env node
/**
 * qa-runner (PF-F8 T6) — servicio Playwright que reclama jobs de navegador de
 * la DB (`claimQaBrowserJob`, T1), ejecuta el catálogo de checks `nav` (T2)
 * sobre el preview firmado (`signQaPreviewToken`, T3) y cierra el job
 * (`finishQaBrowserJob` → `finalizeQaRunOrchestrated`, T4).
 *
 * Arquitectura (D1/D2 del plan maestro F8, brief T6):
 *  - Loop de poll cada `POLL_INTERVAL_MS` — concurrencia 1: un job a la vez.
 *  - Un `chromium` por job, lanzado al reclamar y CERRADO al terminar (idle
 *    sin browser vivo) — nunca un browser reutilizado entre jobs.
 *  - Timeout duro de `JOB_TIMEOUT_MS` (4 min): si un job no termina a
 *    tiempo, se cierra el browser a la fuerza (aborta cualquier operación en
 *    curso) y el job se marca `timed_out`.
 *  - El loop JAMÁS muere por un job: `runJobSafely` envuelve TODO en
 *    try/catch — un fallo marca el job `failed`, invoca el cierre
 *    orquestado, y el poll CONTINÚA con el siguiente job.
 *  - Shutdown limpio en SIGTERM/SIGINT: dejan de reclamarse jobs nuevos y,
 *    si hay un browser vivo, se cierra (lo que aborta el job en curso, que
 *    su propio try/catch marca `failed`/`timed_out` según corresponda).
 *
 * Uso local (selftest, fuera de este loop): ver `selftest.ts`.
 */
import { chromium } from "playwright";
import {
  claimQaBrowserJob,
  finishQaBrowserJob,
  updateQaRunProgress,
  insertQaFindings,
  getProjectOwnerIdInternal,
} from "@/lib/db/repos/pixelforge";
import type { PixelforgeQaRun } from "@/lib/db/schema";
import { finalizeQaRunOrchestrated } from "@/lib/pixelforge/qa/finalize";
import { signQaPreviewToken } from "@/lib/pixelforge/qa/preview-token";
import { loadQaRunnerEnv, type QaRunnerEnv } from "./env";
import { touchHeartbeat } from "./heartbeat";
import { buildQaPreviewUrl } from "./url";
import { originOf } from "./security";
import { runQaBrowserJob } from "./run-job";
import { resolveRunnerVersion, resolvePlaywrightVersion } from "./runner-version";

const POLL_INTERVAL_MS = 3_000;
const JOB_TIMEOUT_MS = 4 * 60 * 1000;
const PREVIEW_TOKEN_TTL_SEC = 600;

let shuttingDown = false;
let currentBrowser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

function requestShutdown(signal: string): void {
  console.log(`[qa-runner] señal ${signal} recibida — dejando de reclamar jobs nuevos.`);
  shuttingDown = true;
  if (currentBrowser) {
    currentBrowser.close().catch(() => {});
  }
}

process.on("SIGTERM", () => requestShutdown("SIGTERM"));
process.on("SIGINT", () => requestShutdown("SIGINT"));

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Best-effort: nunca deja que un fallo de cierre tumbe el catch que lo invoca. */
async function safeFinishAndFinalize(
  qaRunId: string,
  outcome: "succeeded" | "failed" | "timed_out",
  engine?: unknown
): Promise<void> {
  try {
    await finishQaBrowserJob(qaRunId, outcome, engine);
  } catch (err) {
    console.error(`[qa-runner] job ${qaRunId}: finishQaBrowserJob falló`, err);
  }
  try {
    await finalizeQaRunOrchestrated(qaRunId);
  } catch (err) {
    console.error(`[qa-runner] job ${qaRunId}: finalizeQaRunOrchestrated falló`, err);
  }
}

async function processJob(job: PixelforgeQaRun, env: QaRunnerEnv): Promise<void> {
  const qaRunId = job.id;
  console.log(`[qa-runner] job ${qaRunId} (proyecto ${job.projectId}) — arrancando fase navegador.`);

  await updateQaRunProgress(qaRunId, 35, "navegador").catch((err) => {
    console.error(`[qa-runner] job ${qaRunId}: updateQaRunProgress falló (no bloqueante)`, err);
  });

  const ownerId = await getProjectOwnerIdInternal(job.projectId);
  if (!ownerId) {
    console.error(`[qa-runner] job ${qaRunId}: el proyecto ${job.projectId} no tiene owner — no debería pasar.`);
    await safeFinishAndFinalize(qaRunId, "failed", { runner: resolveRunnerVersion(), error: "proyecto sin owner" });
    return;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const token = signQaPreviewToken(
    {
      qaRunId,
      projectId: job.projectId,
      pageVersionId: job.pageVersionId,
      ownerId,
      exp: nowSec + PREVIEW_TOKEN_TTL_SEC,
    },
    env.previewTokenSecret
  );
  const previewUrl = buildQaPreviewUrl(env.appBaseUrl, job.projectId, token);
  const allowedOrigin = originOf(env.appBaseUrl);
  if (!allowedOrigin) {
    await safeFinishAndFinalize(qaRunId, "failed", {
      runner: resolveRunnerVersion(),
      error: `QA_INTERNAL_APP_URL inválida: ${env.appBaseUrl}`,
    });
    return;
  }

  let timedOut = false;
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  currentBrowser = browser;
  const timeoutTimer = setTimeout(() => {
    timedOut = true;
    browser.close().catch(() => {});
  }, JOB_TIMEOUT_MS);

  try {
    const { findings, screenshots } = await runQaBrowserJob(browser, previewUrl, allowedOrigin, {
      ownerId,
      projectId: job.projectId,
      qaRunId,
    });

    clearTimeout(timeoutTimer);

    if (findings.length > 0) {
      await insertQaFindings(qaRunId, findings);
    }

    const engine = {
      runner: resolveRunnerVersion(),
      playwright: resolvePlaywrightVersion(),
      chromium: browser.version(),
      screenshots,
      findingsCount: findings.length,
    };

    await finishQaBrowserJob(qaRunId, "succeeded", engine);
    await updateQaRunProgress(qaRunId, 80, "ia");
    await finalizeQaRunOrchestrated(qaRunId);
    console.log(`[qa-runner] job ${qaRunId} — succeeded (${findings.length} findings, ${screenshots.length} screenshots).`);
  } catch (err) {
    clearTimeout(timeoutTimer);
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[qa-runner] job ${qaRunId} — ${timedOut ? "timed_out" : "failed"}: ${message}`);
    await safeFinishAndFinalize(qaRunId, timedOut ? "timed_out" : "failed", {
      runner: resolveRunnerVersion(),
      error: message,
    });
  } finally {
    currentBrowser = null;
    await browser.close().catch(() => {});
  }
}

/** Envuelve `processJob` en un try/catch de última instancia — el loop JAMÁS muere por un job, sin importar qué tan temprano falle. */
async function runJobSafely(job: PixelforgeQaRun, env: QaRunnerEnv): Promise<void> {
  try {
    await processJob(job, env);
  } catch (err) {
    console.error(`[qa-runner] job ${job.id} — excepción no capturada por processJob`, err);
    await safeFinishAndFinalize(job.id, "failed", { runner: resolveRunnerVersion(), error: String(err) });
  }
}

async function loop(env: QaRunnerEnv): Promise<void> {
  console.log("[qa-runner] loop arrancado — poll cada", POLL_INTERVAL_MS, "ms.");
  while (!shuttingDown) {
    touchHeartbeat();
    let job: PixelforgeQaRun | null = null;
    try {
      job = await claimQaBrowserJob();
    } catch (err) {
      console.error("[qa-runner] claimQaBrowserJob falló (reintenta en el próximo poll)", err);
    }

    if (!job) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    await runJobSafely(job, env);
  }
  console.log("[qa-runner] loop detenido (shutdown limpio).");
}

async function main(): Promise<void> {
  const env = loadQaRunnerEnv();
  await loop(env);
}

main().catch((err) => {
  console.error("[qa-runner] error fatal al arrancar:", err);
  process.exit(1);
});
