/**
 * POST /api/pixelforge/qa/runs — arranca un QA (F8) sobre la versión
 * compuesta vigente de un proyecto. GET — lista las corridas de QA del
 * proyecto (barriendo runs atorados primero).
 *
 * Mismo patrón de auth/zod/errores que `src/app/api/pixelforge/runs/route.ts`
 * (F2-F7): auth → ownership → guards de negocio (409) → crear el registro →
 * `status→running` (AWAITEADO, `startQaRunPhase1` — mismo criterio que
 * `claimRun` en `runs/route.ts`: la respuesta ya dice `status:"running"`, así
 * que la fila en DB debe reflejarlo antes de responder) → responder DE
 * INMEDIATO → disparar el resto de la fase 1 fire-and-forget (sin `await`)
 * para que el cliente pollee `GET .../:qaRunId` (hook `usePixelforgeQaRun`)
 * en vez de bloquear la respuesta HTTP. A diferencia de `runs/route.ts` (que
 * dispara una corrida de IA completa), acá lo que corre fire-and-forget es
 * SOLO `runDeterministicChecks`+persistencia (T2, in-process — milisegundos,
 * no una llamada al modelo) — el resto del QA (navegador, IA advisory,
 * cierre) lo orquestan `finalizeQaRunOrchestrated` (invocado lazily desde el
 * GET de detalle) y los workers de T5/T6 cuando existan.
 *
 * Guards de negocio (409, ambos ANTES de crear el registro):
 *  1. El proyecto debe tener al menos una versión compuesta (`page_versions`)
 *     — no hay nada que evaluar sin eso.
 *  2. No puede haber ya un QA `queued`/`running` para este proyecto
 *     (`getActiveQaRun`). El unique parcial de DB (`pixelforge_qa_runs_active_idx`)
 *     es la red de seguridad real contra la carrera entre este chequeo y el
 *     insert de `createQaRun` — su violación se traduce a
 *     `QaRunAlreadyActiveError` (T1) y este handler la mapea a 409 también,
 *     en vez de dejar subir el 500 crudo.
 *
 * `sweepStaleQaRuns(projectId)` corre ANTES de estos guards (mismo criterio
 * que el GET de detalle) para que un QA viejo atorado no bloquee para
 * siempre el guard #2 con un falso "ya hay uno activo".
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import {
  getPixelforgeProjectFull,
  getPixelforgeProject,
  getLatestPageVersion,
  getActiveQaRun,
  createQaRun,
  startQaRunPhase1,
  insertQaFindings,
  updateQaRunProgress,
  failQaRun,
  sweepStaleQaRuns,
  listQaRunsForProject,
  QaRunAlreadyActiveError,
  type Actor,
} from "@/lib/db/repos/pixelforge";
import { runDeterministicChecks } from "@/lib/pixelforge/qa/run-deterministic";
import { QA_CATALOG_VERSION } from "@/lib/pixelforge/qa/catalog";
import { QA_SCORING_VERSION } from "@/lib/pixelforge/qa/scoring";
import { launchQaAdvisoryRuns } from "@/lib/pixelforge/qa/advisory";

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

export const runtime = "nodejs";

const createQaRunSchema = z.object({
  projectId: z.string().uuid("Proyecto inválido"),
});

export async function POST(req: NextRequest) {
  // Visible en el catch para el best-effort de cierre de un run huérfano —
  // mismo patrón que `runs/route.ts` (F2, decisión I1).
  let qaRunId: string | undefined;

  try {
    const session = await auth();
    const ownerId = session?.user?.id;
    if (!ownerId) return fail("No autenticado", 401);
    const actor: Actor = {
      id: ownerId,
      name: session.user?.name ?? session.user?.email ?? "Usuario",
    };

    const parsed = createQaRunSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(parsed.error.errors[0]?.message ?? "Petición inválida", 400);
    }
    const { projectId } = parsed.data;

    const full = await getPixelforgeProjectFull(projectId, ownerId);
    if (!full) return fail("Proyecto no encontrado", 404);

    await sweepStaleQaRuns(projectId);

    const pageVersion = await getLatestPageVersion(projectId, ownerId);
    if (!pageVersion) {
      return fail("El proyecto todavía no tiene una versión compuesta para evaluar", 409);
    }

    const activeRun = await getActiveQaRun(projectId, ownerId);
    if (activeRun) {
      return fail("Ya hay un QA activo para este proyecto — espera a que termine o falle", 409);
    }

    try {
      const created = await createQaRun(
        projectId,
        ownerId,
        {
          pageVersionId: pageVersion.id,
          catalogVersion: QA_CATALOG_VERSION,
          scoringVersion: QA_SCORING_VERSION,
        },
        actor
      );
      qaRunId = created.id;
    } catch (err) {
      if (err instanceof QaRunAlreadyActiveError) return fail(err.message, 409);
      throw err;
    }

    // `status → running` se AWAITEA acá (no dentro del fire-and-forget de
    // abajo) — mismo criterio que `claimRun` en `runs/route.ts`: la respuesta
    // de este POST YA dice `status:"running"`, así que la fila en DB debe
    // reflejar eso ANTES de responder (si no, un poll inmediato del cliente
    // vería `queued`, contradiciendo la respuesta). Si esto lanza, el catch
    // externo hace el best-effort de cierre (ver abajo).
    await startQaRunPhase1(qaRunId);

    // Insumos de la fase 1 — resueltos ACÁ (mismo momento que el guard),
    // congelados por closure para el fire-and-forget de abajo. La dirección
    // `chosen` (si existe) aporta designTokens/motionDna; su ausencia es un
    // estado válido (QA-DI-006 lo reporta, T2).
    const chosen = full.directions.find(
      (direction) => direction.id === full.project.chosenDirectionId && direction.status === "chosen"
    );
    const chosenDirection = chosen ? { designTokens: chosen.designTokens, status: chosen.status } : null;
    const motionDna = chosen?.motionDna;
    const tree = pageVersion.tree;

    const claimedQaRunId = qaRunId;

    // Fire-and-forget: mismo patrón que `runs/route.ts` (F2, decisión I1) —
    // el handler ya responde abajo; esto sigue corriendo en background. El
    // catch es el único best-effort de cierre para cualquier excepción de
    // acá en adelante (nunca debe dejar el run colgado en 'running').
    void (async () => {
      try {
        const result = runDeterministicChecks({ tree, chosenDirection, motionDna });
        await insertQaFindings(claimedQaRunId, result.findings);
        await updateQaRunProgress(claimedQaRunId, 35, "navegador");
        await launchQaAdvisoryRuns({ qaRunId: claimedQaRunId, projectId });
      } catch (err) {
        console.error("[pixelforge/qa/runs background]", err);
        try {
          await failQaRun(claimedQaRunId, "internal", err instanceof Error ? err.message : "Error inesperado");
        } catch {}
      }
    })();

    return NextResponse.json({ qaRunId, status: "running" as const });
  } catch (err) {
    console.error("[pixelforge/qa/runs POST]", err);
    if (qaRunId) {
      // Best-effort: si el run quedó colgado (error entre `createQaRun` y el
      // fire-and-forget), ciérralo como fallido para que el poller del
      // cliente no se quede esperando para siempre. Si esto también falla,
      // no hay nada más que hacer — ya estamos en el catch global.
      try {
        await failQaRun(qaRunId, "internal", "Error inesperado");
      } catch {}
    }
    return fail("Error inesperado", 500);
  }
}

const listQuerySchema = z.string().uuid("Proyecto inválido");

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const ownerId = session?.user?.id;
    if (!ownerId) return fail("No autenticado", 401);

    const parsed = listQuerySchema.safeParse(req.nextUrl.searchParams.get("projectId"));
    if (!parsed.success) {
      return fail(parsed.error.errors[0]?.message ?? "Petición inválida", 400);
    }
    const projectId = parsed.data;

    const project = await getPixelforgeProject(projectId, ownerId);
    if (!project) return fail("Proyecto no encontrado", 404);

    await sweepStaleQaRuns(projectId);

    const runs = await listQaRunsForProject(projectId, ownerId);
    return NextResponse.json({ runs });
  } catch (err) {
    console.error("[pixelforge/qa/runs GET]", err);
    return fail("Error inesperado", 500);
  }
}
