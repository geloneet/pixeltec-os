/**
 * POST /api/pixelforge/runs — arranca una corrida IA de PixelForge.
 *
 * F3-T1 abre esto a un mapa de operaciones HABILITADAS (`ENABLED_OPERATIONS`,
 * NO un framework genérico): `analyze_context`/`generate_strategy` (F2/F3) y,
 * desde F4-T4, `analyze_reference`/`synthesize_visual_dna` — las 7 operaciones
 * restantes llegan en fases posteriores, de ahí el zod `enum` acotado. Cada
 * entrada del mapa define la compuerta de negocio (`guard`), cómo arma el
 * request al modelo (`buildRequest`), qué refines de dominio validan el
 * resultado (`domainSchema`), dónde queda registrado el resultado
 * (`resultRef`/`persistResult`) y, opcionalmente, un dato operación-específico
 * resuelto una sola vez (`loadExtra` — lo usa `analyze_reference` para
 * resolver la referencia por id ANTES de guard/buildRequest/inputSummary) —
 * el resto del flujo (createRun/claimRun/fire-and-forget) es COMPARTIDO entre
 * operaciones, sin bifurcaciones por operación fuera de este mapa. `analyze_reference`
 * es la única operación POR-REFERENCIA (no por-proyecto): el body debe traer
 * `referenceId` además de `projectId` (`createRunSchema.superRefine`), y su
 * resultado NO es un artifact — vive en `pixelforge_visual_references.analysis`
 * (`resultRef: "reference:<id>"`, `persistResult` llama `updateReferenceAnalysis`
 * en vez de `updateArtifactDraft`). El POST arranca la operación y responde de
 * INMEDIATO con `{ runId, status: "running" }` en cuanto `claimRun` confirma
 * que la corrida quedó reservada; `executeOperation` sigue corriendo en
 * background (fire-and-forget, sin `await` en el handler) y reporta progreso
 * vía `updateRunProgress` mientras tanto, así que el cliente pollea
 * `GET /api/pixelforge/runs/:runId` (hook `usePixelforgeRun`, patrón
 * `growthJobs`) para ver el avance y el resultado final.
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
 * Otro riesgo aceptado (TOCTOU del guard de negocio): `opConfig.guard(full)`
 * valida contra el estado leído en `full` ANTES de que la corrida arranque,
 * pero el trabajo real (`buildRequest`/`executeOperation`) corre después,
 * fire-and-forget — si el Context Brief se reabre a media corrida de
 * `generate_strategy` (entre la carga de `full` y el fire-and-forget que arma
 * el request), el draft resultante de `landing_dna` se escribe a partir de un
 * Context Brief que ya quedó obsoleto en DB. No hay lock entre el guard y la
 * persistencia del resultado. Se acepta porque es autocorregible: el usuario
 * ve un `landing_dna` desactualizado y, al notarlo, vuelve a correr
 * `generate_strategy` — el guard ya exige que el Context Brief esté sellado
 * de nuevo, así que la siguiente corrida reconstruye el request con el brief
 * vigente.
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
  getVisualReferenceForOwner,
  updateReferenceAnalysis,
  replaceCreativeDirections,
  replaceCreativeDirection,
  type Actor,
  type PixelforgeProjectFull,
  type VisualReferenceForAnalysis,
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
import { landingDnaDomainSchema, landingDnaSchema } from "@/lib/pixelforge/schemas/generate-strategy";
import {
  buildAnalyzeReferenceRequest,
  ANALYZE_REFERENCE_PROMPT_VERSION,
} from "@/lib/pixelforge/ai/prompts/analyze-reference.v1";
import {
  buildSynthesizeVisualDnaRequest,
  SYNTHESIZE_VISUAL_DNA_PROMPT_VERSION,
} from "@/lib/pixelforge/ai/prompts/synthesize-visual-dna.v1";
import { referenceAnalysisSchema } from "@/lib/pixelforge/schemas/analyze-reference";
import { visualDnaSchema } from "@/lib/pixelforge/schemas/synthesize-visual-dna";
import {
  buildGenerateDirectionsRequest,
  GENERATE_DIRECTIONS_PROMPT_VERSION,
  type GenerateDirectionsMode,
} from "@/lib/pixelforge/ai/prompts/generate-directions.v1";
import {
  buildCreativeDirectionsDomainSchema,
  creativeDirectionsSchema,
  type Direccion,
} from "@/lib/pixelforge/schemas/generate-directions";
import { getCapabilitiesForPrompt, CAPABILITY_IDS } from "@/lib/pixelforge/registry/capabilities";

/** Contexto compartido de una corrida — común a todas las operaciones del mapa. */
interface OperationRunCtx {
  referenceId?: string;
  ownerId: string;
  /** Solo `generate_directions`: si viene, regenera ESE slot; si no, genera las 3 direcciones completas. */
  slot?: number;
}

/** Tipo real de `domainSchema` en `executeOperation` (`z.ZodTypeAny | undefined`, `zod/v4`) — se deriva de la firma en vez de importar `zod/v4` acá (reservado a `src/lib/pixelforge/schemas/`, ver ese docstring). */
type DomainSchemaOf = Parameters<typeof executeOperation>[0]["domainSchema"];

/**
 * `extra`: dato operación-específico resuelto UNA vez (`loadExtra`) y pasado
 * a `guard`/`buildRequest`/`inputSummary` — así `analyze_reference` resuelve
 * la referencia (con `assetUrl` ya unido, ver `getVisualReferenceForOwner`)
 * en una sola consulta en vez de repetirla en cada función. Las operaciones
 * que no la necesitan simplemente ignoran el parámetro (queda `undefined`).
 */
interface OperationConfig {
  loadExtra?: (full: PixelforgeProjectFull, ctx: OperationRunCtx) => Promise<unknown>;
  /** Compuerta de negocio — string de error (→ 409) si la operación no puede arrancar, null si puede. */
  guard: (full: PixelforgeProjectFull, ctx: OperationRunCtx, extra: unknown) => string | null;
  buildRequest: (
    full: PixelforgeProjectFull,
    ctx: OperationRunCtx,
    extra: unknown
  ) => { system: string; messages: Anthropic.MessageParam[] };
  /** Metadatos de `ai_runs.inputSummary` — JAMÁS contenido crudo del usuario, solo tamaños/ids. */
  inputSummary: (full: PixelforgeProjectFull, ctx: OperationRunCtx, extra: unknown) => Record<string, unknown>;
  /** `ai_runs.resultRef` — dónde vive el resultado (`artifact:<kind>` o `reference:<id>`). */
  resultRef: (ctx: OperationRunCtx) => string;
  persistResult: (
    output: unknown,
    ctx: OperationRunCtx & { projectId: string; actor: Actor; runId: string }
  ) => Promise<void>;
  /**
   * Refines de dominio a aplicar DESPUÉS del parseo de Structured Outputs —
   * valor fijo (las 4 operaciones previas a F5) o función de `(ctx, extra)`
   * (decisión de diseño F5 #3: `generate_directions` necesita un refine
   * distinto según si la request es generación completa o regeneración de un
   * slot, y eso solo se sabe en runtime, no al declarar `ENABLED_OPERATIONS`).
   * El POST resuelve cuál de las dos formas aplica vía `resolveDomainSchema`
   * ANTES de llamar `executeOperation` — ese motor sigue recibiendo siempre
   * un `z.ZodTypeAny | undefined` ya resuelto, sin saber que existe esta
   * bifurcación.
   */
  domainSchema: DomainSchemaOf | ((ctx: OperationRunCtx, extra: unknown) => DomainSchemaOf);
  promptVersion: string;
}

/** Exportado para test — la única línea que resuelve la bifurcación valor/función de `OperationConfig.domainSchema` (ver su docstring) antes de pasarla a `executeOperation`. */
export function resolveDomainSchema(
  domainSchema: OperationConfig["domainSchema"],
  ctx: OperationRunCtx,
  extra: unknown
): DomainSchemaOf {
  return typeof domainSchema === "function" ? domainSchema(ctx, extra) : domainSchema;
}

/**
 * Operaciones IA habilitadas en esta fase. Extender esto (F4+) es agregar una
 * entrada nueva — el resto del handler no cambia.
 */
const ENABLED_OPERATIONS = {
  analyze_context: {
    loadExtra: undefined,
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
    inputSummary: (full) => ({
      titleLength: full.project.title.length,
      brainDumpLength: full.project.brainDump.length,
      sourceCount: full.sources.length,
      sourceIds: full.sources.map((s) => s.id),
    }),
    resultRef: () => "artifact:context_brief",
    persistResult: (output, ctx) =>
      updateArtifactDraft(ctx.projectId, ctx.ownerId, "context_brief", output, ctx.actor, { lastRunId: ctx.runId }),
    domainSchema: contextBriefDomainSchema,
    promptVersion: ANALYZE_CONTEXT_PROMPT_VERSION,
  },
  generate_strategy: {
    loadExtra: undefined,
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
    inputSummary: (full) => ({
      titleLength: full.project.title.length,
      brainDumpLength: full.project.brainDump.length,
      sourceCount: full.sources.length,
      sourceIds: full.sources.map((s) => s.id),
    }),
    resultRef: () => "artifact:landing_dna",
    persistResult: (output, ctx) =>
      updateArtifactDraft(ctx.projectId, ctx.ownerId, "landing_dna", output, ctx.actor, { lastRunId: ctx.runId }),
    domainSchema: landingDnaDomainSchema,
    promptVersion: GENERATE_STRATEGY_PROMPT_VERSION,
  },
  analyze_reference: {
    // Resuelve la referencia UNA vez (con `assetUrl` ya unido) — guard/buildRequest/inputSummary la reusan.
    loadExtra: (full, ctx) => {
      void full;
      // `ctx.referenceId` ya fue validado por `createRunSchema` (superRefine: requerido para esta operación).
      return getVisualReferenceForOwner(ctx.referenceId!, ctx.ownerId);
    },
    // Guard: la referencia debe existir, pertenecer al owner (ya lo garantiza `getVisualReferenceForOwner`,
    // join a `pixelforgeProjects` por `ownerId`) Y pertenecer AL PROYECTO de este body — un owner con varias
    // referencias no puede analizar la de otro proyecto pasando un `projectId` distinto.
    guard: (full, ctx, extra) => {
      if (!ctx.referenceId) return "Falta referenceId";
      const reference = extra as VisualReferenceForAnalysis | null;
      if (!reference || reference.projectId !== full.project.id) {
        return "Referencia no encontrada";
      }
      return null;
    },
    buildRequest: (full, ctx, extra) => {
      void full;
      void ctx;
      // El guard ya garantizó que `extra` no es null.
      const reference = extra as VisualReferenceForAnalysis;
      return buildAnalyzeReferenceRequest({
        reference: {
          kind: reference.kind,
          label: reference.label,
          url: reference.url,
          fetchedMeta: reference.fetchedMeta,
          assetUrl: reference.assetUrl,
          note: reference.note,
        },
      });
    },
    // Sin contenido — solo metadatos, ni siquiera la nota/URL del trabajador.
    inputSummary: (full, ctx, extra) => {
      void full;
      const reference = extra as VisualReferenceForAnalysis | null;
      return { referenceId: ctx.referenceId, kind: reference?.kind ?? null, hasImage: reference?.kind === "image" };
    },
    resultRef: (ctx) => `reference:${ctx.referenceId}`,
    persistResult: (output, ctx) => updateReferenceAnalysis(ctx.referenceId!, { analysis: output }),
    // Sin refines de dominio — el schema (SOLO enums cerrados) ya es la validación completa; no lo relajamos.
    domainSchema: undefined,
    promptVersion: ANALYZE_REFERENCE_PROMPT_VERSION,
  },
  synthesize_visual_dna: {
    loadExtra: undefined,
    guard: (full) => {
      const visualDna = full.artifacts.find((a) => a.kind === "visual_dna");
      if (visualDna?.status === "sealed") {
        return "El Visual DNA está sellado; reábrelo para re-sintetizar";
      }
      const landingDna = full.artifacts.find((a) => a.kind === "landing_dna");
      if (landingDna?.status !== "sealed") {
        return "Sella la Estrategia antes de sintetizar el Visual DNA";
      }
      const analyzedCount = full.visualReferences.filter((r) => r.analysis != null).length;
      if (analyzedCount === 0) {
        return "Analiza al menos una referencia primero";
      }
      return null;
    },
    buildRequest: (full) => {
      // El guard ya garantizó que landing_dna está sellado — sealedContent existe.
      const landingDnaArtifact = full.artifacts.find((a) => a.kind === "landing_dna");
      const sealedLandingDna = landingDnaSchema.parse(landingDnaArtifact?.sealedContent);
      const references = full.visualReferences
        .filter((r) => r.analysis != null)
        .map((r) => ({
          id: r.id,
          label: r.label,
          weight: r.weight,
          // `analysis` es jsonb (`unknown`) — re-validar la FORMA acá en vez de castear a ciegas, mismo
          // criterio que `contextBriefSchema.parse`/`landingDnaSchema.parse` arriba.
          analysis: referenceAnalysisSchema.parse(r.analysis),
        }));
      return buildSynthesizeVisualDnaRequest({
        title: full.project.title,
        landingDna: sealedLandingDna,
        references,
      });
    },
    inputSummary: (full) => ({
      titleLength: full.project.title.length,
      referenceCount: full.visualReferences.length,
      analyzedReferenceCount: full.visualReferences.filter((r) => r.analysis != null).length,
    }),
    resultRef: () => "artifact:visual_dna",
    persistResult: (output, ctx) =>
      updateArtifactDraft(ctx.projectId, ctx.ownerId, "visual_dna", output, ctx.actor, { lastRunId: ctx.runId }),
    // synthesize-visual-dna.ts no define refines de dominio (a diferencia de generate-strategy) — se omite.
    domainSchema: undefined,
    promptVersion: SYNTHESIZE_VISUAL_DNA_PROMPT_VERSION,
  },
  generate_directions: {
    loadExtra: undefined,
    // Guard: 1) el ADN Visual debe estar sellado (fuente de las direcciones); 2) la decisión no puede
    // estar sellada (si lo está, hay que reabrirla primero — decisión F5 #6); 3) regenerar un slot exige
    // que las 3 direcciones completas ya existan (no tiene sentido regenerar sin generación previa).
    guard: (full, ctx) => {
      const visualDna = full.artifacts.find((a) => a.kind === "visual_dna");
      if (visualDna?.status !== "sealed") {
        return "Sella el ADN Visual antes de generar direcciones";
      }
      const decision = full.artifacts.find((a) => a.kind === "direction_decision");
      if (decision?.status === "sealed") {
        return "Reabre la decisión antes de regenerar";
      }
      if (ctx.slot && full.directions.length !== 3) {
        return "Genera las direcciones completas antes de regenerar un slot";
      }
      return null;
    },
    buildRequest: (full, ctx) => {
      // El guard ya garantizó que visual_dna/landing_dna están sellados — sealedContent existe.
      const visualDnaArtifact = full.artifacts.find((a) => a.kind === "visual_dna");
      const sealedVisualDna = visualDnaSchema.parse(visualDnaArtifact?.sealedContent);
      const landingDnaArtifact = full.artifacts.find((a) => a.kind === "landing_dna");
      const sealedLandingDna = landingDnaSchema.parse(landingDnaArtifact?.sealedContent);

      const mode: GenerateDirectionsMode = ctx.slot
        ? {
            kind: "slot",
            slot: ctx.slot,
            currentDirections: full.directions
              .filter((d) => d.slot !== ctx.slot)
              .map((d) => ({
                slot: d.slot,
                title: d.title,
                concept: d.concept,
                // `signatureMotif` es jsonb (`unknown` en Drizzle) — el shape lo garantiza el propio
                // `persistResult` de esta operación (mismo criterio que el cast a `PackedDirectionScores`
                // del repo, T3), así que basta castear en vez de re-validar la forma completa acá.
                motifNombre: (d.signatureMotif as Direccion["signatureMotif"]).nombre,
              })),
          }
        : { kind: "full" };

      return buildGenerateDirectionsRequest({
        title: full.project.title,
        landingDna: sealedLandingDna,
        visualDna: sealedVisualDna,
        capabilitiesCatalog: getCapabilitiesForPrompt(),
        mode,
      });
    },
    inputSummary: (full, ctx) => ({
      mode: ctx.slot ? "slot" : "full",
      slot: ctx.slot,
      capabilitiesCount: CAPABILITY_IDS.length,
      directionsCount: full.directions.length,
    }),
    resultRef: () => "directions:project",
    // El domain ya garantizó (vía `domainSchema` de esta misma entrada) que `output` trae exactamente
    // la cantidad de direcciones esperada por modo — acá solo se re-valida la FORMA (mismo criterio de
    // `landingDnaSchema.parse`/`contextBriefSchema.parse` arriba) antes de pasarla al repo.
    persistResult: (output, ctx) => {
      const { direcciones } = creativeDirectionsSchema.parse(output);
      if (ctx.slot) {
        return replaceCreativeDirection(ctx.projectId, ctx.ownerId, ctx.slot, direcciones[0], ctx.runId, ctx.actor);
      }
      return replaceCreativeDirections(ctx.projectId, ctx.ownerId, direcciones, ctx.runId, ctx.actor);
    },
    // Función, no valor fijo (decisión F5 #3): el refine correcto depende del modo de la request, resuelto
    // acá mismo a partir de `ctx.slot` — `resolveDomainSchema` la invoca en el POST antes de `executeOperation`.
    domainSchema: (ctx) =>
      buildCreativeDirectionsDomainSchema(ctx.slot ? { mode: "slot", slot: ctx.slot } : { mode: "full" }),
    promptVersion: GENERATE_DIRECTIONS_PROMPT_VERSION,
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

/** Exportado para test — ver `route.test.ts` (analyze_reference exige `referenceId`; `slot` solo con `generate_directions`). */
export const createRunSchema = z
  .object({
    projectId: z.string().uuid("Proyecto inválido"),
    operation: z.enum(
      ["analyze_context", "generate_strategy", "analyze_reference", "synthesize_visual_dna", "generate_directions"],
      {
        errorMap: () => ({ message: "Operación no disponible en esta fase" }),
      }
    ),
    // Solo `analyze_reference` es POR-REFERENCIA — ver el `superRefine` debajo. El resto de operaciones
    // ignora este campo aunque venga en el body.
    referenceId: z.string().uuid("Referencia inválida").optional(),
    // Solo `generate_directions` lo usa — si viene, regenera ESE slot; si no, genera las 3 direcciones
    // completas. Ver el `superRefine` debajo (solo válido junto a `generate_directions`).
    slot: z.number().int().min(1).max(3).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.operation === "analyze_reference" && !data.referenceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["referenceId"],
        message: "Falta referenceId para analizar una referencia",
      });
    }
    if (data.slot !== undefined && data.operation !== "generate_directions") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slot"],
        message: "slot solo aplica a generate_directions",
      });
    }
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
    const { projectId, operation, referenceId, slot } = parsed.data;
    const opConfig = ENABLED_OPERATIONS[operation];
    const opCtx: OperationRunCtx = { referenceId, ownerId, slot };

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

    // Dato operación-específico resuelto UNA vez (ver docstring de `loadExtra` en `OperationConfig`) —
    // `undefined` para las operaciones que no lo necesitan.
    const extra = await opConfig.loadExtra?.(full, opCtx);

    // ── Compuerta de negocio: específica de cada operación (ver ENABLED_OPERATIONS) ──
    const guardError = opConfig.guard(full, opCtx, extra);
    if (guardError) return fail(guardError, 409);

    runId = await createRun({
      projectId,
      ownerId,
      operation,
      model: resolvePixelForgeModel(operation),
      promptVersion: opConfig.promptVersion,
      // Metadatos únicamente — JAMÁS el texto del usuario (brainDump/fuentes/nota/URL de referencia)
      // en un campo que se loguea/inspecciona fuera del flujo de la IA.
      inputSummary: opConfig.inputSummary(full, opCtx, extra),
      resultRef: opConfig.resultRef(opCtx),
      actor,
    });

    const claimed = await claimRun(runId);
    if (!claimed) return fail("La corrida no pudo iniciarse (ya estaba en curso)", 409);

    const { system, messages } = opConfig.buildRequest(full, opCtx, extra);

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
          domainSchema: resolveDomainSchema(opConfig.domainSchema, opCtx, extra),
          callbacks: {
            onProgress: (progress, currentStep) => updateRunProgress(claimedRunId, progress, currentStep),
            persistResult: (output) =>
              opConfig.persistResult(output, { ...opCtx, projectId, actor, runId: claimedRunId }),
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
