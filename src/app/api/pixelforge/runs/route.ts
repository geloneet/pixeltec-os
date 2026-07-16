/**
 * POST /api/pixelforge/runs — arranca una corrida IA de PixelForge.
 *
 * F3-T1 abre esto a un mapa de operaciones HABILITADAS (`ENABLED_OPERATIONS`,
 * NO un framework genérico): hoy `analyze_context` (F2) y `generate_strategy`
 * (F3) — las 9 operaciones restantes llegan en fases posteriores, de ahí el
 * zod `enum` acotado. Cada entrada del mapa define el artifact que la
 * operación llena (`targetKind`), la compuerta de negocio (`guard`), cómo
 * arma el request al modelo (`buildRequest`) y qué refines de dominio validan
 * el resultado (`domainSchema`) — el resto del flujo (createRun/claimRun/
 * fire-and-forget/persistResult) es COMPARTIDO entre operaciones, sin
 * bifurcaciones por operación fuera de este mapa. El POST arranca la
 * operación y responde de INMEDIATO con `{ runId, status: "running" }` en
 * cuanto `claimRun` confirma que la corrida quedó reservada; `executeOperation`
 * sigue corriendo en background (fire-and-forget, sin `await` en el handler)
 * y reporta progreso vía `updateRunProgress` mientras tanto, así que el
 * cliente pollea `GET /api/pixelforge/runs/:runId` (hook `usePixelforgeRun`,
 * patrón `growthJobs`) para ver el avance y el resultado final.
 *
 * Por qué fire-and-forget (decisión I1 de la revisión final F2): antes el
 * handler hacía `await executeOperation(...)` y devolvía el resultado en la
 * MISMA respuesta HTTP — pero una corrida de IA puede tardar más de 60s
 * (el límite de nginx/proxy delante de Next.js en este repo), lo que
 * producía un 504 aunque la corrida siguiera viva del lado del servidor
 * (dejando al cliente sin respuesta Y sin nada útil que pollear mientras
 * tanto). Self-hosted en Node (no serverless/edge): el proceso del servidor
 * sigue vivo después de que este handler responde, así que una promesa
 * disparada sin `await` sigue ejecutándose normalmente — no hace falta
 * `waitUntil`/equivalente de runtimes serverless. Riesgo aceptado para F2:
 * si el proceso Node muere a mitad de una corrida (deploy, crash, OOM),
 * esa corrida queda "running" huérfana visible en la UI (el poller nunca
 * ve succeeded/failed) — no hay watchdog todavía. Se documenta y se acepta
 * para esta fase; un mecanismo de detección de huérfanos es mejora futura.
 *
 * Mismo patrón de auth/errores que `src/app/api/definition/generate/route.ts`.
 */
import type { Anthropic } from "@anthropic-ai/sdk";
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
  type PixelforgeProjectFull,
} from "@/lib/db/repos/pixelforge";
import { executeOperation } from "@/lib/pixelforge/ai/run";
import { getPixelforgeAnthropic, resolvePixelForgeModel } from "@/lib/pixelforge/ai/client";
import {
  buildAnalyzeContextRequest,
  ANALYZE_CONTEXT_PROMPT_VERSION,
} from "@/lib/pixelforge/ai/prompts/analyze-context.v1";
import { contextBriefDomainSchema, contextBriefSchema } from "@/lib/pixelforge/schemas/analyze-context";
import {
  buildGenerateStrategyRequest,
  GENERATE_STRATEGY_PROMPT_VERSION,
} from "@/lib/pixelforge/ai/prompts/generate-strategy.v1";
import { landingDnaDomainSchema } from "@/lib/pixelforge/schemas/generate-strategy";
import type { PixelforgeArtifactKind } from "@/lib/pixelforge/types";

interface OperationConfig {
  targetKind: PixelforgeArtifactKind;
  /** Compuerta de negocio — string de error (→ 409) si la operación no puede arrancar, null si puede. */
  guard: (full: PixelforgeProjectFull) => string | null;
  buildRequest: (full: PixelforgeProjectFull) => { system: string; messages: Anthropic.MessageParam[] };
  domainSchema: Parameters<typeof executeOperation>[0]["domainSchema"];
  promptVersion: string;
}

/**
 * Operaciones IA habilitadas en esta fase. Extender esto (F4+) es agregar una
 * entrada nueva — el resto del handler no cambia.
 */
const ENABLED_OPERATIONS = {
  analyze_context: {
    targetKind: "context_brief",
    // Compuerta actual: no re-analizar un Context Brief ya sellado — comportamiento IDÉNTICO al de F2.
    guard: (full) => {
      const contextBrief = full.artifacts.find((a) => a.kind === "context_brief");
      if (contextBrief?.status === "sealed") {
        return "El Context Brief está sellado; reábrelo para re-analizar";
      }
      return null;
    },
    buildRequest: (full) =>
      buildAnalyzeContextRequest({
        title: full.project.title,
        brainDump: full.project.brainDump,
        sources: full.sources.map((s) => ({
          id: s.id,
          tipo: s.type,
          titulo: s.title,
          contenido: s.content,
        })),
      }),
    domainSchema: contextBriefDomainSchema,
    promptVersion: ANALYZE_CONTEXT_PROMPT_VERSION,
  },
  generate_strategy: {
    targetKind: "landing_dna",
    guard: (full) => {
      const landingDna = full.artifacts.find((a) => a.kind === "landing_dna");
      if (landingDna?.status === "sealed") {
        return "El Landing DNA está sellado; reábrelo para re-generar";
      }
      const contextBrief = full.artifacts.find((a) => a.kind === "context_brief");
      if (contextBrief?.status !== "sealed") {
        return "Sella el Contexto antes de generar la estrategia";
      }
      return null;
    },
    buildRequest: (full) => {
      // El guard ya garantizó que context_brief está sellado — sealedContent existe. Se re-valida la
      // FORMA acá (jsonb infiere `unknown` en el schema de Drizzle, ver comentario en db/schema.ts) en
      // vez de castear a ciegas.
      const contextBriefArtifact = full.artifacts.find((a) => a.kind === "context_brief");
      const sealedContent = contextBriefSchema.parse(contextBriefArtifact?.sealedContent);
      return buildGenerateStrategyRequest({
        title: full.project.title,
        brainDump: full.project.brainDump,
        sources: full.sources.map((s) => ({
          id: s.id,
          tipo: s.type,
          titulo: s.title,
          contenido: s.content,
        })),
        contextBrief: sealedContent,
      });
    },
    domainSchema: landingDnaDomainSchema,
    promptVersion: GENERATE_STRATEGY_PROMPT_VERSION,
  },
} satisfies Record<string, OperationConfig>;

export const runtime = "nodejs";
// Ya no acota la duración real de este handler (responde apenas `claimRun` confirma, ver
// comentario de cabecera I1) — el trabajo largo corre fire-and-forget DESPUÉS de la respuesta.
// Se conserva porque es el patrón que ya usan `growth/generate-post` y
// `growth/campaigns/[campaignId]/strategy` en este repo (relevante en runtimes serverless/edge
// donde `maxDuration` limita la función completa, no solo la respuesta); inofensivo dejarlo en
// self-hosted Node, donde no aplica.
export const maxDuration = 60;

const createRunSchema = z.object({
  projectId: z.string().uuid("Proyecto inválido"),
  operation: z.enum(["analyze_context", "generate_strategy"], {
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
    const opConfig = ENABLED_OPERATIONS[operation];

    // I3: validar ANTES de crear la corrida — si no hay API key configurada, `getPixelforgeAnthropic()`
    // (llamado más abajo, ya en background) lanzaría igual, pero para entonces ya habríamos creado
    // un registro `ai_runs` y devuelto 200 al cliente. Cortar acá evita corridas basura.
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "El motor de IA no está configurado (falta ANTHROPIC_API_KEY)" },
        { status: 503 }
      );
    }

    const full = await getPixelforgeProjectFull(projectId, ownerId);
    if (!full) return fail("Proyecto no encontrado", 404);

    // ── Compuerta de negocio: específica de cada operación (ver ENABLED_OPERATIONS) ──
    const guardError = opConfig.guard(full);
    if (guardError) return fail(guardError, 409);

    runId = await createRun({
      projectId,
      ownerId,
      operation,
      model: resolvePixelForgeModel(operation),
      promptVersion: opConfig.promptVersion,
      // Metadatos únicamente — JAMÁS el texto del usuario (brainDump/fuentes)
      // en un campo que se loguea/inspecciona fuera del flujo de la IA.
      inputSummary: {
        titleLength: full.project.title.length,
        brainDumpLength: full.project.brainDump.length,
        sourceCount: full.sources.length,
        sourceIds: full.sources.map((s) => s.id),
      },
      resultRef: `artifact:${opConfig.targetKind}`,
      actor,
    });

    const claimed = await claimRun(runId);
    if (!claimed) return fail("La corrida no pudo iniciarse (ya estaba en curso)", 409);

    const { system, messages } = opConfig.buildRequest(full);

    // Nota transaccional: `persistResult` (guarda el draft del artifact) y
    // `finishRun` (cierra la corrida) corren SECUENCIALES dentro del motor
    // (persistencia primero — lo garantiza `executeOperation`, F2-T3). No
    // comparten `tx` en F2: si `finishRun` fallara justo después de que
    // `persistResult` ya escribió, el draft queda guardado y la corrida
    // queda "running" — un huérfano visible (el usuario ve el draft nuevo
    // pero la corrida nunca cierra), no una corrupción de datos. Aceptado
    // para F2; una tx compartida es mejora futura si el caso se presenta.
    //
    // I1: `runId` ya está confirmado (`claimed === true`) — cerrado sobre una
    // const no-opcional para las callbacks, en vez de seguir castenado
    // `runId as string` como antes.
    const claimedRunId = runId;

    // Fire-and-forget: NO se hace `await` acá — el handler responde de inmediato (debajo) y esta
    // promesa sigue corriendo en background. Ver comentario de cabecera (I1) para el razonamiento
    // completo. El catch de ESTA promesa es el único best-effort de cierre para errores que ocurran
    // DESPUÉS de que el handler ya respondió (p.ej. si algo no capturado internamente por
    // `executeOperation` lanzara, o si una de las callbacks fallara) — el catch del try/catch
    // externo de este handler ya no puede cubrir esta parte, porque para cuando corre el handler ya
    // habrá devuelto la respuesta HTTP.
    void (async () => {
      try {
        await executeOperation({
          client: getPixelforgeAnthropic(),
          operation,
          system,
          messages,
          domainSchema: opConfig.domainSchema,
          callbacks: {
            onProgress: (progress, currentStep) => updateRunProgress(claimedRunId, progress, currentStep),
            persistResult: (output) =>
              updateArtifactDraft(projectId, ownerId, opConfig.targetKind, output, actor, { lastRunId: claimedRunId }),
            finishRun: (r) => finishRunRecord(claimedRunId, r),
          },
        });
      } catch (err) {
        console.error("[pixelforge/runs background]", err);
        // Best-effort: mismo patrón que el catch global de abajo, pero acá — ya no hay respuesta
        // HTTP pendiente que dependa de esto, solo evitar que la corrida quede "running" para
        // siempre si algo lanzó por fuera del manejo interno de `executeOperation`.
        try {
          await finishRunRecord(claimedRunId, {
            status: "failed",
            failureKind: "provider_error",
            error: "Error inesperado",
            durationMs: 0,
            retryCount: 0,
          });
        } catch {}
      }
    })();

    return NextResponse.json({ runId, status: "running" as const });
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
