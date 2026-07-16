/**
 * POST /api/pixelforge/runs — arranca una corrida IA de PixelForge.
 *
 * F2 solo soporta `analyze_context` (las otras 10 operaciones llegan en
 * fases posteriores — de ahí el zod `literal`). El POST ejecuta la operación
 * INLINE (síncrono, sin cola de workers): llama al motor
 * (`executeOperation`, F2-T3) que reporta progreso vía `updateRunProgress`
 * mientras corre, así que el cliente puede pollear
 * `GET /api/pixelforge/runs/:runId` (hook `usePixelforgeRun`, patrón
 * `growthJobs`) para ver el avance aunque la respuesta HTTP de este POST no
 * llegue hasta que termine.
 *
 * Mismo patrón de auth/errores que `src/app/api/definition/generate/route.ts`.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { enforceRateLimit, formatRetryAfter } from "@/lib/rate-limit";
import {
  getPixelforgeProjectFull,
  createRun,
  claimRun,
  updateRunProgress,
  finishRunRecord,
  updateArtifactDraft,
  type Actor,
} from "@/lib/db/repos/pixelforge";
import { executeOperation } from "@/lib/pixelforge/ai/run";
import { getPixelforgeAnthropic, resolvePixelForgeModel } from "@/lib/pixelforge/ai/client";
import {
  buildAnalyzeContextRequest,
  ANALYZE_CONTEXT_PROMPT_VERSION,
} from "@/lib/pixelforge/ai/prompts/analyze-context.v1";
import { contextBriefDomainSchema } from "@/lib/pixelforge/schemas/analyze-context";

export const runtime = "nodejs";
export const maxDuration = 60;

const createRunSchema = z.object({
  projectId: z.string().uuid("Proyecto inválido"),
  operation: z.literal("analyze_context", {
    errorMap: () => ({ message: "Operación no disponible en esta fase" }),
  }),
});

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: NextRequest) {
  // Visible en el catch para el best-effort de cierre de corrida huérfana.
  let runId: string | undefined;

  try {
    const session = await auth();
    const ownerId = session?.user?.id;
    if (!ownerId) return fail("No autenticado", 401);
    const actor: Actor = {
      id: ownerId,
      name: session.user?.name ?? session.user?.email ?? "Usuario",
    };

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const rl = await enforceRateLimit({
      ip,
      bucket: "pixelforge_runs",
      max: 20,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.allowed) {
      return fail(`Demasiadas solicitudes. Espera ${formatRetryAfter(rl.retryAfterSec)} e intenta de nuevo.`, 429);
    }

    const parsed = createRunSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(parsed.error.errors[0]?.message ?? "Petición inválida", 400);
    }
    const { projectId, operation } = parsed.data;

    const full = await getPixelforgeProjectFull(projectId, ownerId);
    if (!full) return fail("Proyecto no encontrado", 404);

    // ── Compuerta: no re-analizar un Context Brief ya sellado ──────────────
    const contextBrief = full.artifacts.find((a) => a.kind === "context_brief");
    if (contextBrief?.status === "sealed") {
      return fail("El Context Brief está sellado; reábrelo para re-analizar", 409);
    }

    runId = await createRun({
      projectId,
      ownerId,
      operation,
      model: resolvePixelForgeModel(operation),
      promptVersion: ANALYZE_CONTEXT_PROMPT_VERSION,
      // Metadatos únicamente — JAMÁS el texto del usuario (brainDump/fuentes)
      // en un campo que se loguea/inspecciona fuera del flujo de la IA.
      inputSummary: {
        titleLength: full.project.title.length,
        brainDumpLength: full.project.brainDump.length,
        sourceCount: full.sources.length,
        sourceIds: full.sources.map((s) => s.id),
      },
      resultRef: "artifact:context_brief",
      actor,
    });

    const claimed = await claimRun(runId);
    if (!claimed) return fail("La corrida no pudo iniciarse (ya estaba en curso)", 409);

    const { system, messages } = buildAnalyzeContextRequest({
      title: full.project.title,
      brainDump: full.project.brainDump,
      sources: full.sources.map((s) => ({
        id: s.id,
        tipo: s.type,
        titulo: s.title,
        contenido: s.content,
      })),
    });

    // Nota transaccional: `persistResult` (guarda el draft del artifact) y
    // `finishRun` (cierra la corrida) corren SECUENCIALES dentro del motor
    // (persistencia primero — lo garantiza `executeOperation`, F2-T3). No
    // comparten `tx` en F2: si `finishRun` fallara justo después de que
    // `persistResult` ya escribió, el draft queda guardado y la corrida
    // queda "running" — un huérfano visible (el usuario ve el draft nuevo
    // pero la corrida nunca cierra), no una corrupción de datos. Aceptado
    // para F2; una tx compartida es mejora futura si el caso se presenta.
    const result = await executeOperation({
      client: getPixelforgeAnthropic(),
      operation,
      system,
      messages,
      domainSchema: contextBriefDomainSchema,
      callbacks: {
        onProgress: (progress, currentStep) => updateRunProgress(runId as string, progress, currentStep),
        persistResult: (output) =>
          updateArtifactDraft(projectId, ownerId, "context_brief", output, actor, { lastRunId: runId }),
        finishRun: (r) => finishRunRecord(runId as string, r),
      },
    });

    if ("output" in result) {
      return NextResponse.json({ runId, status: "succeeded" as const });
    }
    return NextResponse.json({ runId, status: "failed" as const, failure: result.failure, error: result.error });
  } catch (err) {
    console.error("[pixelforge/runs POST]", err);
    if (runId) {
      // Best-effort: si la corrida quedó colgada (error entre `claimRun` y el
      // cierre normal del motor), ciérrala como fallida para que el poller
      // del cliente no se quede esperando para siempre. Si esto también
      // falla, no hay nada más que hacer — ya estamos en el catch global.
      try {
        await finishRunRecord(runId, {
          status: "failed",
          failureKind: "provider_error",
          error: "Error inesperado",
          durationMs: 0,
          retryCount: 0,
        });
      } catch {}
    }
    return fail("Error inesperado", 500);
  }
}
