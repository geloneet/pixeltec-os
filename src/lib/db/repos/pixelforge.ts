/**
 * Repo de "PixelForge" — landings por estaciones (F1: fundaciones).
 *
 * Todo el CRUD va escopado por `ownerId` (patrón de definitions.ts / crm.ts).
 * A diferencia de "Definición de Proyecto", un proyecto PixelForge SIEMPRE
 * cuelga de un cliente y arranca de una vez: al crearse ya nacen las 5 filas
 * de artifact (una por `ARTIFACT_KINDS`, en `pending`) y queda en la estación
 * `contexto`. Cada operación relevante deja un `pixelforge_events` para
 * auditoría.
 *
 * Ver src/lib/pixelforge/types.ts para el orden canónico de estaciones y de
 * artifacts.
 */
import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import postgres from "postgres";
import { db } from "@/lib/db";
import { deleteObject } from "@/lib/r2/upload";
import {
  clients,
  pixelforgeProjects,
  pixelforgeContextSources,
  pixelforgeArtifacts,
  pixelforgeEvents,
  pixelforgeAiRuns,
  pixelforgeAssets,
  pixelforgeVisualReferences,
  pixelforgeCreativeDirections,
  pixelforgePageVersions,
  pixelforgeQaRuns,
  pixelforgeQaFindings,
  pixelforgeReviews,
  pixelforgeReviewComments,
  type PixelforgeProject,
  type PixelforgeContextSource,
  type PixelforgeArtifact,
  type PixelforgeEvent,
  type PixelforgeAiRun,
  type PixelforgeAsset,
  type PixelforgeVisualReference,
  type PixelforgeCreativeDirection,
  type PixelforgePageVersion,
  type PixelforgeQaRun,
  type PixelforgeQaFinding,
  type PixelforgeReview,
  type PixelforgeReviewComment,
} from "@/lib/db/schema";
import {
  ARTIFACT_KINDS,
  downstreamKinds,
  nextStation,
  stationForKind,
  type PixelforgeArtifactKind,
  type PixelforgeStation,
  type PixelforgeSourceType,
} from "@/lib/pixelforge/types";
import type { PixelforgeAIOperation } from "@/lib/pixelforge/schemas";
import { computeTreeHash, treeHashMatches } from "@/lib/pixelforge/review/canonical-hash";
import {
  validateAcceptedRisks,
  type AcceptedRiskEntry,
  type FindingLike,
} from "@/lib/pixelforge/review/approval-rules";
import { resolveChangeTarget, type ChangeKind } from "@/lib/pixelforge/review/target-station";
import {
  computeQaGateState,
  wouldRunOpenGate,
  type QaGateClosedReason,
} from "@/lib/pixelforge/qa/gate-state";
import { computeScoreTotal, type DirectionScores } from "@/lib/pixelforge/scores";
import { directionDecisionSchema } from "@/lib/pixelforge/schemas/direction-decision";
// Import de SOLO TIPO — no cruza zod/v4 al repo (restricción global: zod/v4
// vive solo en `src/lib/pixelforge/schemas/`). `Direccion` es la forma que
// Structured Outputs garantiza para una dirección creativa (una entrada del
// array `direcciones` de `creativeDirectionsSchema`).
import type { Direccion } from "@/lib/pixelforge/schemas/generate-directions";

export interface Actor {
  id: string;
  name: string;
}

/** Tx de `db.transaction` — para funciones que aceptan un `tx` opcional del caller. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ─── Escritura ───────────────────────────────────────────────────────────

export interface CreatePixelforgeProjectInput {
  ownerId: string;
  clientId: string;
  clientCrmId: string;
  title: string;
  brainDump: string;
  definitionId?: string | null;
  /** Contenido sellado ya concatenado (lo arma la action). */
  definitionImport?: { title: string; content: string } | null;
  actor: Actor;
}

/**
 * Crea el proyecto + las 5 filas de artifact (una por `ARTIFACT_KINDS`, en
 * `pending`) + el evento `created`, en una transacción. Si viene
 * `definitionId` y `definitionImport`, además registra una
 * `pixelforge_context_sources` de tipo `definition_import` con el contenido
 * sellado importado, y un evento `source_added` en la estación `contexto`.
 * Devuelve el id del proyecto.
 */
export function createPixelforgeProject(
  input: CreatePixelforgeProjectInput
): Promise<string> {
  return db.transaction(async (tx) => {
    const [project] = await tx
      .insert(pixelforgeProjects)
      .values({
        ownerId: input.ownerId,
        clientId: input.clientId,
        clientCrmId: input.clientCrmId,
        definitionId: input.definitionId ?? null,
        title: input.title,
        brainDump: input.brainDump,
        currentStation: "contexto",
        status: "in_progress",
      })
      .returning({ id: pixelforgeProjects.id });

    await tx.insert(pixelforgeArtifacts).values(
      ARTIFACT_KINDS.map((kind) => ({
        projectId: project.id,
        kind,
        status: "pending" as const,
      }))
    );

    await tx.insert(pixelforgeEvents).values({
      projectId: project.id,
      station: null,
      type: "created",
      actorId: input.actor.id,
      actorName: input.actor.name,
    });

    if (input.definitionId && input.definitionImport) {
      await tx.insert(pixelforgeContextSources).values({
        projectId: project.id,
        type: "definition_import",
        title: input.definitionImport.title,
        content: input.definitionImport.content,
        addedById: input.actor.id,
        addedByName: input.actor.name,
      });

      await tx.insert(pixelforgeEvents).values({
        projectId: project.id,
        station: "contexto",
        type: "source_added",
        actorId: input.actor.id,
        actorName: input.actor.name,
      });
    }

    return project.id;
  });
}

export interface AddContextSourceInput {
  type: PixelforgeSourceType;
  title: string;
  content: string;
  url?: string | null;
}

/**
 * Agrega una fuente de contexto a un proyecto ya existente. Verifica
 * ownership antes de escribir (lanza si no existe/no es del owner). Deja
 * evento `source_added` en la estación `contexto` y toca `updatedAt` del
 * proyecto. NO toca `brainDump` ni artifacts/sellos — solo inserta la fuente.
 * Devuelve el id de la fuente creada.
 */
export function addContextSource(
  projectId: string,
  ownerId: string,
  input: AddContextSourceInput,
  actor: Actor
): Promise<string> {
  return db.transaction(async (tx) => {
    const [project] = await tx
      .select({ id: pixelforgeProjects.id })
      .from(pixelforgeProjects)
      .where(
        and(
          eq(pixelforgeProjects.id, projectId),
          eq(pixelforgeProjects.ownerId, ownerId)
        )
      )
      .limit(1);
    if (!project) throw new Error("Proyecto no encontrado");

    const [source] = await tx
      .insert(pixelforgeContextSources)
      .values({
        projectId,
        type: input.type,
        title: input.title,
        content: input.content,
        url: input.url ?? null,
        addedById: actor.id,
        addedByName: actor.name,
      })
      .returning({ id: pixelforgeContextSources.id });

    await tx.insert(pixelforgeEvents).values({
      projectId,
      station: "contexto",
      type: "source_added",
      actorId: actor.id,
      actorName: actor.name,
      snapshot: null,
    });

    await touchProject(tx, projectId);

    return source.id;
  });
}

// ─── Lectura ───────────────────────────────────────────────────────────────

/** Solo la fila de proyecto, escopada por owner. Null si no existe. */
export function getPixelforgeProject(
  projectId: string,
  ownerId: string
): Promise<PixelforgeProject | null> {
  return db
    .select()
    .from(pixelforgeProjects)
    .where(
      and(
        eq(pixelforgeProjects.id, projectId),
        eq(pixelforgeProjects.ownerId, ownerId)
      )
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export interface PixelforgeProjectFull {
  project: PixelforgeProject;
  /** Ordenados según `ARTIFACT_KINDS`. */
  artifacts: PixelforgeArtifact[];
  /** Orden asc por `createdAt`. */
  sources: PixelforgeContextSource[];
  /** Orden desc por `createdAt`. */
  events: PixelforgeEvent[];
  /** Referencias visuales (F4) — orden asc por `createdAt`. */
  visualReferences: PixelforgeVisualReference[];
  /**
   * Assets del proyecto (F4: imágenes de referencia subidas a R2) — SIN
   * resolver contra `visualReferences.assetId` acá; el caller (p.ej.
   * `visual/page.tsx`) hace ese join en memoria para armar el `assetUrl` por
   * referencia. Se trae completo (no solo las urls) por si una fase futura
   * necesita más metadata del asset.
   */
  assets: PixelforgeAsset[];
  /** Direcciones creativas (F5) — orden asc por `slot`. */
  directions: PixelforgeCreativeDirection[];
}

/** Proyecto + artifacts + fuentes + eventos + referencias visuales + assets + direcciones, escopado por owner. Null si no existe. */
export async function getPixelforgeProjectFull(
  projectId: string,
  ownerId: string
): Promise<PixelforgeProjectFull | null> {
  const project = await getPixelforgeProject(projectId, ownerId);
  if (!project) return null;

  const [artifacts, sources, events, visualReferences, assets, directions] = await Promise.all([
    db
      .select()
      .from(pixelforgeArtifacts)
      .where(eq(pixelforgeArtifacts.projectId, projectId)),
    db
      .select()
      .from(pixelforgeContextSources)
      .where(eq(pixelforgeContextSources.projectId, projectId))
      .orderBy(asc(pixelforgeContextSources.createdAt)),
    db
      .select()
      .from(pixelforgeEvents)
      .where(eq(pixelforgeEvents.projectId, projectId))
      .orderBy(desc(pixelforgeEvents.createdAt)),
    db
      .select()
      .from(pixelforgeVisualReferences)
      .where(eq(pixelforgeVisualReferences.projectId, projectId))
      .orderBy(asc(pixelforgeVisualReferences.createdAt)),
    db.select().from(pixelforgeAssets).where(eq(pixelforgeAssets.projectId, projectId)),
    db
      .select()
      .from(pixelforgeCreativeDirections)
      .where(eq(pixelforgeCreativeDirections.projectId, projectId))
      .orderBy(asc(pixelforgeCreativeDirections.slot)),
  ]);

  // Orden estable de artifacts según la secuencia canónica de kinds.
  artifacts.sort(
    (a, b) => ARTIFACT_KINDS.indexOf(a.kind) - ARTIFACT_KINDS.indexOf(b.kind)
  );

  return { project, artifacts, sources, events, visualReferences, assets, directions };
}

export interface PixelforgeProjectListItem {
  id: string;
  title: string;
  clientId: string;
  clientName: string | null;
  currentStation: PixelforgeStation;
  status: PixelforgeProject["status"];
  createdAt: Date;
  updatedAt: Date;
}

/** Lista de proyectos PixelForge del owner con el nombre del cliente (join). */
export function listPixelforgeProjectsByOwner(
  ownerId: string
): Promise<PixelforgeProjectListItem[]> {
  return db
    .select({
      id: pixelforgeProjects.id,
      title: pixelforgeProjects.title,
      clientId: pixelforgeProjects.clientId,
      clientName: clients.name,
      currentStation: pixelforgeProjects.currentStation,
      status: pixelforgeProjects.status,
      createdAt: pixelforgeProjects.createdAt,
      updatedAt: pixelforgeProjects.updatedAt,
    })
    .from(pixelforgeProjects)
    .leftJoin(clients, eq(pixelforgeProjects.clientId, clients.id))
    .where(eq(pixelforgeProjects.ownerId, ownerId))
    .orderBy(desc(pixelforgeProjects.updatedAt));
}

// ─── Runs (F2) ──────────────────────────────────────────────────────────────

export interface CreateRunInput {
  projectId: string;
  ownerId: string;
  operation: PixelforgeAIOperation | string;
  model: string;
  promptVersion: string;
  inputSummary: unknown;
  resultRef?: string | null;
  actor: Actor;
}

/**
 * Crea una corrida IA (`queued`) + evento `run_started` (station null,
 * snapshot null, reason = operation), en una transacción. Verifica ownership
 * del proyecto antes de escribir. Devuelve el id de la corrida.
 */
export function createRun(input: CreateRunInput): Promise<string> {
  return db.transaction(async (tx) => {
    const [project] = await tx
      .select({ id: pixelforgeProjects.id })
      .from(pixelforgeProjects)
      .where(
        and(
          eq(pixelforgeProjects.id, input.projectId),
          eq(pixelforgeProjects.ownerId, input.ownerId)
        )
      )
      .limit(1);
    if (!project) throw new Error("Proyecto no encontrado");

    const [run] = await tx
      .insert(pixelforgeAiRuns)
      .values({
        projectId: input.projectId,
        operation: input.operation,
        status: "queued",
        model: input.model,
        promptVersion: input.promptVersion,
        inputSummary: input.inputSummary,
        resultRef: input.resultRef ?? null,
        requestedById: input.actor.id,
        requestedByName: input.actor.name,
      })
      .returning({ id: pixelforgeAiRuns.id });

    await tx.insert(pixelforgeEvents).values({
      projectId: input.projectId,
      station: null,
      type: "run_started",
      actorId: input.actor.id,
      actorName: input.actor.name,
      reason: input.operation,
      snapshot: null,
    });

    return run.id;
  });
}

/**
 * Claim atómico de una corrida `queued`: UPDATE condicional a `running` — si
 * otro worker ya la reclamó (o no está `queued`), afecta 0 filas. Calco del
 * débito atómico de `src/lib/growth/ai/orchestrator.ts` (`deductCredits`).
 * Devuelve true si ESTA llamada la reclamó.
 */
export async function claimRun(runId: string): Promise<boolean> {
  const claimed = await db
    .update(pixelforgeAiRuns)
    .set({ status: "running", updatedAt: new Date() })
    .where(and(eq(pixelforgeAiRuns.id, runId), eq(pixelforgeAiRuns.status, "queued")))
    .returning({ id: pixelforgeAiRuns.id });
  return claimed.length > 0;
}

/** Actualiza progreso/paso actual de una corrida en curso. */
export async function updateRunProgress(
  runId: string,
  progress: number,
  currentStep: string
): Promise<void> {
  await db
    .update(pixelforgeAiRuns)
    .set({ progress, currentStep, updatedAt: new Date() })
    .where(eq(pixelforgeAiRuns.id, runId));
}

export interface FinishRunResult {
  status: "succeeded" | "failed";
  failureKind?: string | null;
  error?: string | null;
  tokensIn?: number;
  tokensOut?: number;
  durationMs: number;
  retryCount: number;
}

/**
 * Cierra una corrida: update de status/tokens/duración + evento
 * `run_finished` (reason = status, o failureKind si falló). Acepta un `tx`
 * opcional para participar en la transacción del caller (p.ej. junto con
 * `updateArtifactDraft` al persistir el resultado — F2-T5).
 */
export async function finishRunRecord(
  runId: string,
  result: FinishRunResult,
  tx?: Tx
): Promise<void> {
  const exec = tx ?? db;

  const [run] = await exec
    .update(pixelforgeAiRuns)
    .set({
      status: result.status,
      failureKind: result.failureKind ?? null,
      error: result.error ?? null,
      tokensIn: result.tokensIn ?? null,
      tokensOut: result.tokensOut ?? null,
      durationMs: result.durationMs,
      retryCount: result.retryCount,
      updatedAt: new Date(),
    })
    .where(eq(pixelforgeAiRuns.id, runId))
    .returning({
      projectId: pixelforgeAiRuns.projectId,
      requestedById: pixelforgeAiRuns.requestedById,
      requestedByName: pixelforgeAiRuns.requestedByName,
    });
  if (!run) throw new Error("Corrida no encontrada");

  await exec.insert(pixelforgeEvents).values({
    projectId: run.projectId,
    station: null,
    type: "run_finished",
    actorId: run.requestedById,
    actorName: run.requestedByName,
    reason: result.status === "failed" ? result.failureKind ?? result.status : result.status,
    snapshot: null,
  });
}

/** Shape público de una corrida (para el poller del cliente) — sin inputSummary/model/tokens. */
export interface RunPublicView {
  id: string;
  projectId: string;
  operation: string;
  status: PixelforgeAiRun["status"];
  progress: number;
  currentStep: string | null;
  error: string | null;
  resultRef: string | null;
}

/** Corrida escopada por owner (join a `pixelforgeProjects`). Null si no existe/no es del owner. */
export async function getRunForOwner(
  runId: string,
  ownerId: string
): Promise<RunPublicView | null> {
  const [row] = await db
    .select({
      id: pixelforgeAiRuns.id,
      projectId: pixelforgeAiRuns.projectId,
      operation: pixelforgeAiRuns.operation,
      status: pixelforgeAiRuns.status,
      progress: pixelforgeAiRuns.progress,
      currentStep: pixelforgeAiRuns.currentStep,
      error: pixelforgeAiRuns.error,
      resultRef: pixelforgeAiRuns.resultRef,
    })
    .from(pixelforgeAiRuns)
    .innerJoin(pixelforgeProjects, eq(pixelforgeAiRuns.projectId, pixelforgeProjects.id))
    .where(and(eq(pixelforgeAiRuns.id, runId), eq(pixelforgeProjects.ownerId, ownerId)))
    .limit(1);
  return row ?? null;
}

/**
 * Registra la decisión del usuario sobre el resultado de una corrida
 * (aceptado/rechazado — métrica del experimento de modelos). Escopado por
 * owner vía join; lanza si no existe/no es del owner.
 */
export async function setRunUserDecision(
  runId: string,
  ownerId: string,
  decision: "accepted" | "rejected"
): Promise<void> {
  const [run] = await db
    .select({ id: pixelforgeAiRuns.id })
    .from(pixelforgeAiRuns)
    .innerJoin(pixelforgeProjects, eq(pixelforgeAiRuns.projectId, pixelforgeProjects.id))
    .where(and(eq(pixelforgeAiRuns.id, runId), eq(pixelforgeProjects.ownerId, ownerId)))
    .limit(1);
  if (!run) throw new Error("Corrida no encontrada");

  await db
    .update(pixelforgeAiRuns)
    .set({ userDecision: decision, updatedAt: new Date() })
    .where(eq(pixelforgeAiRuns.id, runId));
}

// ─── Artifacts: editar / sellar / reabrir (F2) ─────────────────────────────

/**
 * Guarda el borrador de un artifact. Ownership del proyecto + el artifact
 * debe existir; si está `sealed` lanza (hay que reabrirlo primero). Si
 * estaba `pending` o `invalidated` pasa a `in_progress` (primera edición, o
 * retomar tras invalidación downstream). Actualiza
 * `lastRunId` si viene en `opts`. Toca `updatedAt` del artifact y del
 * proyecto. `actor` se recibe por simetría con el resto de escrituras del
 * repo — esta operación no deja evento propio (igual que
 * `updateStationDraft` en definitions.ts), así que no se usa en el cuerpo.
 */
export async function updateArtifactDraft(
  projectId: string,
  ownerId: string,
  kind: PixelforgeArtifactKind,
  draft: unknown,
  actor: Actor,
  opts?: { lastRunId?: string }
): Promise<void> {
  void actor;
  return db.transaction(async (tx) => {
    const [project] = await tx
      .select({ id: pixelforgeProjects.id })
      .from(pixelforgeProjects)
      .where(and(eq(pixelforgeProjects.id, projectId), eq(pixelforgeProjects.ownerId, ownerId)))
      .limit(1);
    if (!project) throw new Error("Proyecto no encontrado");

    const [artifact] = await tx
      .select()
      .from(pixelforgeArtifacts)
      .where(and(eq(pixelforgeArtifacts.projectId, projectId), eq(pixelforgeArtifacts.kind, kind)))
      .limit(1);
    if (!artifact) throw new Error("Artifact no encontrado");
    if (artifact.status === "sealed") {
      throw new Error("Reabre el artefacto antes de editar");
    }

    const now = new Date();
    await tx
      .update(pixelforgeArtifacts)
      .set({
        currentDraft: draft,
        status:
          artifact.status === "pending" || artifact.status === "invalidated"
            ? "in_progress"
            : artifact.status,
        ...(opts?.lastRunId ? { lastRunId: opts.lastRunId } : {}),
        updatedAt: now,
      })
      .where(eq(pixelforgeArtifacts.id, artifact.id));

    await touchProject(tx, projectId);
  });
}

/**
 * Valida que un draft de `direction_decision` sigue vigente antes de
 * sellarlo: su `chosenDirectionId` debe coincidir con el `chosenDirectionId`
 * ACTUAL del proyecto (fuente de verdad — se limpia a `null` por
 * `replaceCreativeDirections`/`replaceCreativeDirection` cuando una
 * regeneración invalida la dirección elegida, decisión F5 #6). Función
 * pura, testeable sin DB — la usa `sealArtifact` para no dejar sellar una
 * elección obsoleta (antes solo lo evitaba `canSeal` en la UI, que no es una
 * garantía real: nada impedía llamar la action/ruta directo).
 */
export function assertDirectionDecisionStillCurrent(
  draftChosenDirectionId: string,
  projectChosenDirectionId: string | null
): void {
  if (
    projectChosenDirectionId === null ||
    draftChosenDirectionId !== projectChosenDirectionId
  ) {
    throw new Error("La elección quedó obsoleta — vuelve a elegir");
  }
}

/**
 * Sella el artifact activo: congela `currentDraft` en `sealedContent` con
 * fecha/autor, deja evento `sealed`, y si la estación activa del proyecto ES
 * la que sella este kind, avanza `currentStation` a la siguiente. Si
 * `nextStation` fuera null (rama defensiva: no alcanzable con los 5 kinds de
 * F2, que solo llegan hasta `blueprint` — cuyo `nextStation` es `produccion`,
 * no null) el status del proyecto NO cambia acá; producción/QA/revisión
 * (fases futuras) decidirán ahí cuándo completar el proyecto. Transacción.
 *
 * Caso especial `direction_decision` (review final F5): antes de sellar, se
 * re-valida que la elección sigue vigente (`assertDirectionDecisionStillCurrent`)
 * — una regeneración pudo haber invalidado el `chosenDirectionId` del draft
 * entre que la UI cargó la página y este call llegó. `canSeal` en la UI es
 * una ayuda de UX, NO la compuerta real.
 */
export function sealArtifact(
  projectId: string,
  ownerId: string,
  kind: PixelforgeArtifactKind,
  actor: Actor
): Promise<void> {
  return db.transaction(async (tx) => {
    const [project] = await tx
      .select()
      .from(pixelforgeProjects)
      .where(and(eq(pixelforgeProjects.id, projectId), eq(pixelforgeProjects.ownerId, ownerId)))
      .limit(1);
    if (!project) throw new Error("Proyecto no encontrado");

    const [artifact] = await tx
      .select()
      .from(pixelforgeArtifacts)
      .where(and(eq(pixelforgeArtifacts.projectId, projectId), eq(pixelforgeArtifacts.kind, kind)))
      .limit(1);
    if (!artifact) throw new Error("Artifact no encontrado");
    if (artifact.currentDraft === null || artifact.currentDraft === undefined) {
      throw new Error("No hay borrador que sellar");
    }
    if (artifact.status === "sealed") throw new Error("Ya está sellado");

    if (kind === "direction_decision") {
      const draft = directionDecisionSchema.parse(artifact.currentDraft);
      assertDirectionDecisionStillCurrent(draft.chosenDirectionId, project.chosenDirectionId);
    }

    const now = new Date();
    await tx
      .update(pixelforgeArtifacts)
      .set({
        sealedContent: artifact.currentDraft,
        sealedAt: now,
        sealedById: actor.id,
        sealedByName: actor.name,
        status: "sealed",
        updatedAt: now,
      })
      .where(eq(pixelforgeArtifacts.id, artifact.id));

    const station = stationForKind(kind);
    await tx.insert(pixelforgeEvents).values({
      projectId,
      station,
      type: "sealed",
      actorId: actor.id,
      actorName: actor.name,
      snapshot: null,
    });

    if (project.currentStation === station) {
      const next = nextStation(station);
      if (next) {
        await tx
          .update(pixelforgeProjects)
          .set({ currentStation: next, updatedAt: now })
          .where(eq(pixelforgeProjects.id, projectId));
      }
      // else: nextStation null (rama defensiva, ver docstring) — el status
      // del proyecto NO cambia en F2.
    }
  });
}

/**
 * Reabre un artifact sellado (calco de `reopenStation` en definitions.ts):
 * evento `reopened` con snapshot del sello viejo, vuelve `in_progress`
 * retomando desde lo sellado, e invalida el sello de todo kind downstream
 * (evento `invalidated` + snapshot; su `currentDraft` se CONSERVA).
 * Retrocede `currentStation` del proyecto a la estación reabierta y toca su
 * `updatedAt`. `reason` es obligatoria. Transacción.
 *
 * Wrapper público BYTE-COMPATIBLE (firma y comportamiento intactos, contrato
 * F1-F8): valida ownership dentro de la tx y delega el cuerpo a
 * `reopenArtifactInTx`. El único motivo del refactor (PF-F9 T3) es un
 * bloqueante real: `requestChanges` necesita reabrir un artifact DENTRO de su
 * propia transacción (que ya tomó el lock `FOR UPDATE` de la fila de
 * proyecto); si llamara a este wrapper, `db.transaction` abriría OTRA conexión
 * y se DEADLOCKEARÍA contra ese lock. Por eso el cuerpo vive en
 * `reopenArtifactInTx(tx, ...)`, reusable desde una tx externa.
 */
export function reopenArtifact(
  projectId: string,
  ownerId: string,
  kind: PixelforgeArtifactKind,
  reason: string,
  actor: Actor
): Promise<void> {
  return db.transaction(async (tx) => {
    const [project] = await tx
      .select({ id: pixelforgeProjects.id })
      .from(pixelforgeProjects)
      .where(and(eq(pixelforgeProjects.id, projectId), eq(pixelforgeProjects.ownerId, ownerId)))
      .limit(1);
    if (!project) throw new Error("Proyecto no encontrado");

    await reopenArtifactInTx(tx, projectId, kind, reason, actor);
  });
}

/**
 * Cuerpo de `reopenArtifact` (ver docstring del wrapper) sin la validación de
 * ownership — el caller (`reopenArtifact` público o `requestChanges`, F9) DEBE
 * haber verificado ownership + tomado el lock de proyecto ANTES de entrar. No
 * abre transacción propia: opera sobre el `tx` recibido, así se compone con la
 * tx de `requestChanges` sin deadlock. Comportamiento idéntico al original:
 * exige `reason` no vacía y artifact `sealed` (lanza si no), reabre, invalida
 * downstream conservando `currentDraft`, y retrocede `currentStation`.
 */
async function reopenArtifactInTx(
  tx: Tx,
  projectId: string,
  kind: PixelforgeArtifactKind,
  reason: string,
  actor: Actor
): Promise<void> {
  {
    const artifacts = await tx
      .select()
      .from(pixelforgeArtifacts)
      .where(eq(pixelforgeArtifacts.projectId, projectId));

    const target = artifacts.find((a) => a.kind === kind);
    if (!target) throw new Error("Artifact no encontrado");
    if (target.status !== "sealed") {
      throw new Error("Solo se puede reabrir un artefacto sellado");
    }
    if (!reason || reason.trim() === "") {
      throw new Error("La razón es obligatoria");
    }

    const now = new Date();
    const station = stationForKind(kind);

    await tx.insert(pixelforgeEvents).values({
      projectId,
      station,
      type: "reopened",
      actorId: actor.id,
      actorName: actor.name,
      reason,
      snapshot: target.sealedContent,
    });

    await tx
      .update(pixelforgeArtifacts)
      .set({
        status: "in_progress",
        currentDraft: target.sealedContent,
        sealedContent: null,
        sealedAt: null,
        sealedById: null,
        sealedByName: null,
        reopenCount: target.reopenCount + 1,
        updatedAt: now,
      })
      .where(eq(pixelforgeArtifacts.id, target.id));

    // Downstream: invalidar sellos. El currentDraft del invalidado SE CONSERVA.
    for (const downstreamKind of downstreamKinds(kind)) {
      const downstreamArtifact = artifacts.find((a) => a.kind === downstreamKind);
      if (!downstreamArtifact || downstreamArtifact.status !== "sealed") continue;

      await tx.insert(pixelforgeEvents).values({
        projectId,
        station: stationForKind(downstreamKind),
        type: "invalidated",
        actorId: actor.id,
        actorName: actor.name,
        reason,
        snapshot: downstreamArtifact.sealedContent,
      });

      await tx
        .update(pixelforgeArtifacts)
        .set({
          status: "invalidated",
          sealedContent: null,
          sealedAt: null,
          sealedById: null,
          sealedByName: null,
          updatedAt: now,
        })
        .where(eq(pixelforgeArtifacts.id, downstreamArtifact.id));
    }

    await tx
      .update(pixelforgeProjects)
      .set({ currentStation: station, updatedAt: now })
      .where(eq(pixelforgeProjects.id, projectId));
  }
}

// ─── Referencias visuales (F4) ──────────────────────────────────────────────
// El repo SOLO persiste — no fetchea URLs ni decide `coverage`: eso lo hace
// la action (`src/app/(admin)/proyectos/pixelforge/actions.ts`), que ya trae
// `coverage`/`fetchedMeta` resueltos (kind "url": tras `safeFetch` +
// `extractSignals`; kind "image": tras subir a R2 vía `storage.ts`).

export type AddVisualReferenceInput =
  | {
      kind: "url";
      label: string;
      url: string;
      coverage: PixelforgeVisualReference["coverage"];
      /** Señales SANEADAS de `extractSignals` (+ fetchedUrl/status) — NUNCA HTML crudo. */
      fetchedMeta: unknown;
    }
  | {
      kind: "image";
      label: string;
      /** Asset ya creado (ver `createReferenceAsset`) apuntando a la imagen en R2. */
      assetId: string;
      coverage: PixelforgeVisualReference["coverage"];
    }
  | { kind: "note"; label: string; note: string };

/**
 * Persiste una referencia visual (url/image/note) de un proyecto. Ownership
 * del proyecto. Para `kind: "note"` la cobertura es siempre `semantic-only`
 * (una nota no aporta señal visual). Deja evento `reference_added` (snapshot
 * null, reason = kind). `explicitId`: la action de imagen genera el id ANTES
 * de llamar (lo usa también como nombre del objeto en R2, ver
 * `uploadReferenceImage` en `storage.ts`) y lo pasa acá para que la fila
 * nazca con ESE id; si se omite, el id lo genera la DB (`defaultRandom()`).
 * Devuelve el id de la referencia.
 */
export function addVisualReference(
  projectId: string,
  ownerId: string,
  input: AddVisualReferenceInput,
  actor: Actor,
  explicitId?: string
): Promise<string> {
  return db.transaction(async (tx) => {
    const [project] = await tx
      .select({ id: pixelforgeProjects.id })
      .from(pixelforgeProjects)
      .where(and(eq(pixelforgeProjects.id, projectId), eq(pixelforgeProjects.ownerId, ownerId)))
      .limit(1);
    if (!project) throw new Error("Proyecto no encontrado");

    const [reference] = await tx
      .insert(pixelforgeVisualReferences)
      .values({
        ...(explicitId ? { id: explicitId } : {}),
        projectId,
        kind: input.kind,
        label: input.label,
        url: input.kind === "url" ? input.url : null,
        assetId: input.kind === "image" ? input.assetId : null,
        coverage: input.kind === "note" ? "semantic-only" : input.coverage,
        fetchedMeta: input.kind === "url" ? (input.fetchedMeta ?? null) : null,
        note: input.kind === "note" ? input.note : null,
        addedById: actor.id,
        addedByName: actor.name,
      })
      .returning({ id: pixelforgeVisualReferences.id });

    await tx.insert(pixelforgeEvents).values({
      projectId,
      station: "visual",
      type: "reference_added",
      actorId: actor.id,
      actorName: actor.name,
      reason: input.kind,
      snapshot: null,
    });

    await touchProject(tx, projectId);

    return reference.id;
  });
}

export interface CreateReferenceAssetInput {
  url: string;
  r2Key: string;
  contentType: string;
  sizeBytes: number;
}

/**
 * Registra en `pixelforge_assets` (kind `reference_image`) una imagen de
 * referencia YA subida a R2 (la action sube primero vía `storage.ts`, luego
 * llama acá). Ownership del proyecto. Devuelve el id del asset — la action lo
 * usa como `assetId` al llamar `addVisualReference`.
 */
export function createReferenceAsset(
  projectId: string,
  ownerId: string,
  input: CreateReferenceAssetInput,
  actor: Actor
): Promise<string> {
  return db.transaction(async (tx) => {
    const [project] = await tx
      .select({ id: pixelforgeProjects.id })
      .from(pixelforgeProjects)
      .where(and(eq(pixelforgeProjects.id, projectId), eq(pixelforgeProjects.ownerId, ownerId)))
      .limit(1);
    if (!project) throw new Error("Proyecto no encontrado");

    const [asset] = await tx
      .insert(pixelforgeAssets)
      .values({
        projectId,
        kind: "reference_image",
        url: input.url,
        r2Key: input.r2Key,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        uploadedById: actor.id,
        uploadedByName: actor.name,
      })
      .returning({ id: pixelforgeAssets.id });

    return asset.id;
  });
}

/**
 * Elimina una referencia visual. Ownership vía join a `pixelforgeProjects`
 * (mismo patrón que `getRunForOwner`/`setRunUserDecision` — sin un select
 * previo de proyecto). Si la referencia era `kind: "image"` (tenía
 * `assetId`), también borra la fila de `pixelforge_assets`; el objeto en R2
 * se borra DESPUÉS de que la transacción de DB confirme (best-effort —
 * `deleteObject` nunca lanza — y evita mantener la tx abierta durante una
 * llamada de red). Deja evento `reference_removed`. Devuelve el `projectId`
 * de la referencia borrada para que la action pueda revalidar sus rutas
 * (la action solo recibe `referenceId`, no conoce el proyecto de antemano).
 */
export async function removeVisualReference(
  referenceId: string,
  ownerId: string,
  actor: Actor
): Promise<{ projectId: string }> {
  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        projectId: pixelforgeVisualReferences.projectId,
        assetId: pixelforgeVisualReferences.assetId,
      })
      .from(pixelforgeVisualReferences)
      .innerJoin(pixelforgeProjects, eq(pixelforgeVisualReferences.projectId, pixelforgeProjects.id))
      .where(
        and(
          eq(pixelforgeVisualReferences.id, referenceId),
          eq(pixelforgeProjects.ownerId, ownerId)
        )
      )
      .limit(1);
    if (!row) throw new Error("Referencia no encontrada");

    await tx
      .delete(pixelforgeVisualReferences)
      .where(eq(pixelforgeVisualReferences.id, referenceId));

    let r2Key: string | null = null;
    if (row.assetId) {
      const [asset] = await tx
        .select({ r2Key: pixelforgeAssets.r2Key })
        .from(pixelforgeAssets)
        .where(eq(pixelforgeAssets.id, row.assetId))
        .limit(1);
      r2Key = asset?.r2Key ?? null;

      await tx.delete(pixelforgeAssets).where(eq(pixelforgeAssets.id, row.assetId));
    }

    await tx.insert(pixelforgeEvents).values({
      projectId: row.projectId,
      station: "visual",
      type: "reference_removed",
      actorId: actor.id,
      actorName: actor.name,
      snapshot: null,
    });

    await touchProject(tx, row.projectId);

    return { projectId: row.projectId, r2Key };
  });

  if (result.r2Key) {
    await deleteObject(result.r2Key);
  }

  return { projectId: result.projectId };
}

/** Referencias visuales de un proyecto, ownership-checked. Orden asc por `createdAt`. */
export async function listVisualReferences(
  projectId: string,
  ownerId: string
): Promise<PixelforgeVisualReference[]> {
  const project = await getPixelforgeProject(projectId, ownerId);
  if (!project) throw new Error("Proyecto no encontrado");

  return db
    .select()
    .from(pixelforgeVisualReferences)
    .where(eq(pixelforgeVisualReferences.projectId, projectId))
    .orderBy(asc(pixelforgeVisualReferences.createdAt));
}

/**
 * Guarda el análisis IA de una referencia (F4-T4: `analyze_reference`). Sin
 * ownership por diseño — igual que `updateRunProgress`/`finishRunRecord`: la
 * invoca el worker de IA con un `referenceId` ya resuelto internamente, no
 * directamente una action de usuario.
 */
export async function updateReferenceAnalysis(
  referenceId: string,
  input: { analysis: unknown }
): Promise<void> {
  await db
    .update(pixelforgeVisualReferences)
    .set({ analysis: input.analysis, updatedAt: new Date() })
    .where(eq(pixelforgeVisualReferences.id, referenceId));
}

export interface VisualReferenceForAnalysis {
  id: string;
  projectId: string;
  kind: PixelforgeVisualReference["kind"];
  label: string;
  url: string | null;
  fetchedMeta: unknown;
  analysis: unknown;
  weight: number;
  note: string | null;
  /** Resuelta vía join a `pixelforge_assets` — null salvo `kind: "image"`. */
  assetUrl: string | null;
}

/**
 * Referencia visual por id, ownership-checked vía join a `pixelforgeProjects`
 * (mismo patrón que `getRunForOwner`/`setRunUserDecision`), CON la URL
 * pública del asset ya resuelta (join a `pixelforge_assets`) — el route de
 * `analyze_reference` (F4-T4) la necesita para armar el content block
 * `image` sin tener que resolver `assetId` a mano. Null si no existe o no
 * pertenece al owner.
 */
export async function getVisualReferenceForOwner(
  referenceId: string,
  ownerId: string
): Promise<VisualReferenceForAnalysis | null> {
  const [row] = await db
    .select({
      id: pixelforgeVisualReferences.id,
      projectId: pixelforgeVisualReferences.projectId,
      kind: pixelforgeVisualReferences.kind,
      label: pixelforgeVisualReferences.label,
      url: pixelforgeVisualReferences.url,
      fetchedMeta: pixelforgeVisualReferences.fetchedMeta,
      analysis: pixelforgeVisualReferences.analysis,
      weight: pixelforgeVisualReferences.weight,
      note: pixelforgeVisualReferences.note,
      assetUrl: pixelforgeAssets.url,
    })
    .from(pixelforgeVisualReferences)
    .innerJoin(pixelforgeProjects, eq(pixelforgeVisualReferences.projectId, pixelforgeProjects.id))
    .leftJoin(pixelforgeAssets, eq(pixelforgeVisualReferences.assetId, pixelforgeAssets.id))
    .where(and(eq(pixelforgeVisualReferences.id, referenceId), eq(pixelforgeProjects.ownerId, ownerId)))
    .limit(1);
  return row ?? null;
}

// ─── Direcciones creativas (F5) ─────────────────────────────────────────────
// La IA nunca decide `scoreTotal` (se calcula server-side, `computeScoreTotal`)
// ni el status final (`candidate`/`chosen`/`discarded`, decidido acá según la
// operación). `scores` (jsonb) guarda el "paquete de scoring" completo — los 5
// criterios 0-100 de la IA + `scoresRazones` (el porqué de cada criterio) +
// `risks` (riesgos que la IA identificó de esa dirección) — porque la tabla
// (F5-T1) no tiene columnas propias para razones/riesgos y este es el único
// jsonb "sobrante" para no perder esa data entre generaciones.

/** Forma de UNA dirección del output de `generate_directions` (schema T2, `direccionSchema`) — lo que persiste el repo. */
export type DirectionInput = Direccion;

/**
 * Forma empaquetada en la columna jsonb `scores` de una fila de
 * `pixelforge_creative_directions`: los 5 criterios (`DirectionScores`,
 * `scores.ts`) + `scoresRazones` (el porqué de cada criterio) + `risks`
 * (riesgos que la IA identificó de esa dirección) — ver el comentario de
 * cabecera de esta sección para el porqué de empaquetarlos juntos.
 * Exportado para que T4/T5 lean esta columna con el contrato ya tipado, sin
 * re-declararlo.
 */
export type PackedDirectionScores = DirectionScores & {
  scoresRazones: Direccion["scoresRazones"];
  risks: Direccion["risks"];
};

/** Campos de contenido comunes a insertar/actualizar una fila de dirección — todo excepto `projectId`/`slot`/`status`/`generationRunId`, que dependen de si es alta o update. */
function directionContentFields(direction: DirectionInput) {
  const scores: PackedDirectionScores = {
    ...direction.scores,
    scoresRazones: direction.scoresRazones,
    risks: direction.risks,
  };
  return {
    title: direction.title,
    concept: direction.concept,
    designTokens: direction.designTokens,
    motionDna: direction.motionDna,
    signatureMotif: direction.signatureMotif,
    signatureComponent: direction.signatureComponent,
    scores,
    scoreTotal: computeScoreTotal(direction.scores),
  };
}

/**
 * Valida `combinedFromDirectionIds` de `chooseDirection`: cada id debe ser
 * una dirección DISTINTA a la elegida y DEBE pertenecer al mismo proyecto
 * (estar en `projectDirectionIds`, las direcciones ya cargadas en la misma
 * transacción). Lanza con mensaje claro en la primera violación; no
 * modifica nada — función pura, testeable sin DB. Se llama ANTES de
 * escribir cualquier cosa en `chooseDirection` (aceptar ids ajenos sería una
 * superficie IDOR latente si algo downstream los derreferencia sin scope).
 */
export function assertCombinedFromDirectionIdsValid(
  chosenDirectionId: string,
  combinedFromDirectionIds: string[],
  projectDirectionIds: string[]
): void {
  const validIds = new Set(projectDirectionIds);
  for (const combinedId of combinedFromDirectionIds) {
    if (combinedId === chosenDirectionId) {
      throw new Error(
        "combinedFromDirectionIds no puede incluir la propia dirección elegida"
      );
    }
    if (!validIds.has(combinedId)) {
      throw new Error(
        `combinedFromDirectionIds incluye una dirección que no pertenece a este proyecto: ${combinedId}`
      );
    }
  }
}

/**
 * Generación completa: reemplaza las 3 direcciones del proyecto (delete +
 * insert, decisión de diseño F5 #2 — la auditoría de qué había antes vive en
 * `pixelforge_events`, no en filas muertas). Ownership del proyecto. El
 * DELETE dispara `ON DELETE SET NULL` de `chosenDirectionId` a nivel SQL,
 * pero también se pone explícito en la misma transacción para no depender
 * del orden de ejecución. NO toca el artifact `direction_decision` — si
 * tenía un draft (una elección previa), se queda tal cual: la UI detecta que
 * `draft.chosenDirectionId` ya no está entre las direcciones vigentes y
 * muestra la elección como obsoleta (decisión F5 #6). Evento
 * `directions_generated` con snapshot `[{slot,title,scoreTotal}]`.
 *
 * Re-chequea DENTRO de la transacción que `direction_decision` no esté
 * `sealed` (review final F5 — TOCTOU): el guard de la ruta valida esto al
 * arrancar la corrida, pero una corrida de IA tarda ~30s y el usuario pudo
 * sellar la decisión mientras tanto; sin este re-chequeo, este persist
 * borraría/pisaría filas que una decisión ya sellada referencia. Mismo
 * mensaje que el guard de la ruta.
 */
export function replaceCreativeDirections(
  projectId: string,
  ownerId: string,
  directions: DirectionInput[],
  runId: string,
  actor: Actor
): Promise<void> {
  return db.transaction(async (tx) => {
    const [project] = await tx
      .select({ id: pixelforgeProjects.id })
      .from(pixelforgeProjects)
      .where(and(eq(pixelforgeProjects.id, projectId), eq(pixelforgeProjects.ownerId, ownerId)))
      .limit(1);
    if (!project) throw new Error("Proyecto no encontrado");

    const [decisionArtifact] = await tx
      .select({ status: pixelforgeArtifacts.status })
      .from(pixelforgeArtifacts)
      .where(
        and(
          eq(pixelforgeArtifacts.projectId, projectId),
          eq(pixelforgeArtifacts.kind, "direction_decision")
        )
      )
      .limit(1);
    if (decisionArtifact?.status === "sealed") {
      throw new Error("Reabre la decisión antes de regenerar");
    }

    await tx
      .delete(pixelforgeCreativeDirections)
      .where(eq(pixelforgeCreativeDirections.projectId, projectId));

    await tx
      .update(pixelforgeProjects)
      .set({ chosenDirectionId: null })
      .where(eq(pixelforgeProjects.id, projectId));

    const rows = directions.map((direction) => ({
      projectId,
      slot: direction.slot,
      ...directionContentFields(direction),
      status: "candidate" as const,
      generationRunId: runId,
    }));

    if (rows.length > 0) {
      await tx.insert(pixelforgeCreativeDirections).values(rows);
    }

    await tx.insert(pixelforgeEvents).values({
      projectId,
      station: "direcciones",
      type: "directions_generated",
      actorId: actor.id,
      actorName: actor.name,
      reason: `${rows.length} direcciones`,
      snapshot: [...rows]
        .sort((a, b) => a.slot - b.slot)
        .map((row) => ({ slot: row.slot, title: row.title, scoreTotal: row.scoreTotal })),
    });

    await touchProject(tx, projectId);
  });
}

/**
 * Regeneración individual: UPDATE in place del contenido del slot indicado
 * (decisión F5 #2 — regenerar una dirección no crea una fila nueva). Ownership
 * del proyecto; lanza si el slot no existe. Si la dirección regenerada estaba
 * `chosen`, las otras 2 vuelven de `discarded` a `candidate` y
 * `projects.chosenDirectionId` se limpia (la elección quedó obsoleta — la UI
 * lo detecta y pide re-elegir, decisión F5 #6); la propia fila regenerada
 * siempre queda `candidate`. Evento `direction_regenerated` (reason
 * `slot:N`, snapshot = contenido COMPLETO anterior de la fila).
 *
 * Re-chequea DENTRO de la transacción que `direction_decision` no esté
 * `sealed` (review final F5 — TOCTOU, mismo razonamiento que
 * `replaceCreativeDirections`): el guard de la ruta ya lo valida al
 * arrancar la corrida, pero la corrida tarda ~30s y pudo sellarse la
 * decisión mientras corría.
 */
export function replaceCreativeDirection(
  projectId: string,
  ownerId: string,
  slot: number,
  direction: DirectionInput,
  runId: string,
  actor: Actor
): Promise<void> {
  return db.transaction(async (tx) => {
    const [project] = await tx
      .select({ id: pixelforgeProjects.id })
      .from(pixelforgeProjects)
      .where(and(eq(pixelforgeProjects.id, projectId), eq(pixelforgeProjects.ownerId, ownerId)))
      .limit(1);
    if (!project) throw new Error("Proyecto no encontrado");

    const [decisionArtifact] = await tx
      .select({ status: pixelforgeArtifacts.status })
      .from(pixelforgeArtifacts)
      .where(
        and(
          eq(pixelforgeArtifacts.projectId, projectId),
          eq(pixelforgeArtifacts.kind, "direction_decision")
        )
      )
      .limit(1);
    if (decisionArtifact?.status === "sealed") {
      throw new Error("Reabre la decisión antes de regenerar");
    }

    const [existing] = await tx
      .select()
      .from(pixelforgeCreativeDirections)
      .where(
        and(
          eq(pixelforgeCreativeDirections.projectId, projectId),
          eq(pixelforgeCreativeDirections.slot, slot)
        )
      )
      .limit(1);
    if (!existing) throw new Error(`No existe una dirección en el slot ${slot}`);

    const wasChosen = existing.status === "chosen";

    await tx
      .update(pixelforgeCreativeDirections)
      .set({
        ...directionContentFields(direction),
        status: "candidate",
        generationRunId: runId,
        updatedAt: new Date(),
      })
      .where(eq(pixelforgeCreativeDirections.id, existing.id));

    if (wasChosen) {
      await tx
        .update(pixelforgeCreativeDirections)
        .set({ status: "candidate", updatedAt: new Date() })
        .where(
          and(
            eq(pixelforgeCreativeDirections.projectId, projectId),
            ne(pixelforgeCreativeDirections.id, existing.id)
          )
        );

      await tx
        .update(pixelforgeProjects)
        .set({ chosenDirectionId: null })
        .where(eq(pixelforgeProjects.id, projectId));
    }

    await tx.insert(pixelforgeEvents).values({
      projectId,
      station: "direcciones",
      type: "direction_regenerated",
      actorId: actor.id,
      actorName: actor.name,
      reason: `slot:${slot}`,
      snapshot: {
        slot: existing.slot,
        title: existing.title,
        concept: existing.concept,
        designTokens: existing.designTokens,
        motionDna: existing.motionDna,
        signatureMotif: existing.signatureMotif,
        signatureComponent: existing.signatureComponent,
        scores: existing.scores,
        scoreTotal: existing.scoreTotal,
        status: existing.status,
      },
    });

    await touchProject(tx, projectId);
  });
}

/** Direcciones creativas de un proyecto, ownership-checked. Orden asc por `slot`. */
export async function listCreativeDirections(
  projectId: string,
  ownerId: string
): Promise<PixelforgeCreativeDirection[]> {
  const project = await getPixelforgeProject(projectId, ownerId);
  if (!project) throw new Error("Proyecto no encontrado");

  return db
    .select()
    .from(pixelforgeCreativeDirections)
    .where(eq(pixelforgeCreativeDirections.projectId, projectId))
    .orderBy(asc(pixelforgeCreativeDirections.slot));
}

export interface ChooseDirectionInput {
  directionId: string;
  rationale: string;
  acceptedRisks: string[];
  combinedFromDirectionIds: string[];
}

/**
 * Elección auditada de una dirección (decisión F5 #5: la ÚNICA escritura
 * legítima del draft de `direction_decision` — `updateArtifactDraftAction`
 * la rechaza explícitamente). Ownership del proyecto; la dirección debe
 * pertenecer al proyecto (lanza si no); lanza si el artifact
 * `direction_decision` está `sealed` (hay que reabrirlo primero — decisión
 * F5 #6). Marca la elegida `chosen` y el resto `discarded`,
 * `projects.chosenDirectionId = directionId`, escribe `currentDraft` del
 * artifact validado contra `directionDecisionSchema` (mismo avance de status
 * pending/invalidated→in_progress que `updateArtifactDraft`). Evento
 * `direction_chosen` (reason = rationale, snapshot con directionId, slot,
 * title, scoreTotal, acceptedRisks, combinedFromDirectionIds). Transacción.
 */
export function chooseDirection(
  projectId: string,
  ownerId: string,
  input: ChooseDirectionInput,
  actor: Actor
): Promise<void> {
  return db.transaction(async (tx) => {
    const [project] = await tx
      .select({ id: pixelforgeProjects.id })
      .from(pixelforgeProjects)
      .where(and(eq(pixelforgeProjects.id, projectId), eq(pixelforgeProjects.ownerId, ownerId)))
      .limit(1);
    if (!project) throw new Error("Proyecto no encontrado");

    const directions = await tx
      .select()
      .from(pixelforgeCreativeDirections)
      .where(eq(pixelforgeCreativeDirections.projectId, projectId));

    const chosen = directions.find((d) => d.id === input.directionId);
    if (!chosen) throw new Error("La dirección no pertenece a este proyecto");

    // combinedFromDirectionIds solo puede referenciar OTRAS direcciones YA
    // cargadas de este mismo proyecto (superficie IDOR latente si se
    // aceptaran ids ajenos: algo downstream podría derreferenciarlos sin
    // scope). Se valida ANTES de escribir draft/evento.
    assertCombinedFromDirectionIdsValid(
      chosen.id,
      input.combinedFromDirectionIds,
      directions.map((d) => d.id)
    );

    const [artifact] = await tx
      .select()
      .from(pixelforgeArtifacts)
      .where(
        and(
          eq(pixelforgeArtifacts.projectId, projectId),
          eq(pixelforgeArtifacts.kind, "direction_decision")
        )
      )
      .limit(1);
    if (!artifact) throw new Error("Artifact no encontrado");
    if (artifact.status === "sealed") {
      throw new Error("Reabre el artefacto antes de elegir otra dirección");
    }

    const now = new Date();

    await tx
      .update(pixelforgeCreativeDirections)
      .set({ status: "chosen", updatedAt: now })
      .where(eq(pixelforgeCreativeDirections.id, chosen.id));

    const hasOthers = directions.some((d) => d.id !== chosen.id);
    if (hasOthers) {
      await tx
        .update(pixelforgeCreativeDirections)
        .set({ status: "discarded", updatedAt: now })
        .where(
          and(
            eq(pixelforgeCreativeDirections.projectId, projectId),
            ne(pixelforgeCreativeDirections.id, chosen.id)
          )
        );
    }

    await tx
      .update(pixelforgeProjects)
      .set({ chosenDirectionId: chosen.id })
      .where(eq(pixelforgeProjects.id, projectId));

    const draft = directionDecisionSchema.parse({
      chosenDirectionId: input.directionId,
      rationale: input.rationale,
      acceptedRisks: input.acceptedRisks,
      combinedFromDirectionIds: input.combinedFromDirectionIds,
    });

    await tx
      .update(pixelforgeArtifacts)
      .set({
        currentDraft: draft,
        status:
          artifact.status === "pending" || artifact.status === "invalidated"
            ? "in_progress"
            : artifact.status,
        updatedAt: now,
      })
      .where(eq(pixelforgeArtifacts.id, artifact.id));

    await tx.insert(pixelforgeEvents).values({
      projectId,
      station: "direcciones",
      type: "direction_chosen",
      actorId: actor.id,
      actorName: actor.name,
      reason: input.rationale,
      snapshot: {
        directionId: chosen.id,
        slot: chosen.slot,
        title: chosen.title,
        scoreTotal: chosen.scoreTotal,
        acceptedRisks: input.acceptedRisks,
        combinedFromDirectionIds: input.combinedFromDirectionIds,
      },
    });

    await touchProject(tx, projectId);
  });
}

// ─── Page versions (F7 — estación `produccion`) ────────────────────────────

export interface InsertPageVersionInput {
  /** `PageTree` YA validado por `validatePageTree` (T2) — se persiste tal cual, sin re-tipar acá (zod v4 no cruza al repo). */
  tree: unknown;
  notas: string;
  warnings: string[];
}

export interface InsertedPageVersion {
  id: string;
  version: number;
}

/**
 * `version` de la próxima fila a insertar dado el máximo actual del proyecto
 * (`undefined` si el proyecto todavía no tiene ninguna versión). Extraída
 * como función pura para poder testear el cálculo sin DB (mismo patrón que
 * `assertDirectionDecisionStillCurrent`/`assertCombinedFromDirectionIdsValid`
 * más arriba en este archivo).
 */
export function computeNextPageVersion(latest: { version: number } | undefined): number {
  return (latest?.version ?? 0) + 1;
}

/**
 * Inserta una nueva versión de la landing compuesta. Append-only: NUNCA
 * actualiza una fila existente, recomponer siempre crea la siguiente
 * versión (D1/D4 de la fase — sin locks/reconcile). Ownership-checked.
 * `version = max(version) + 1` para el proyecto, calculado DENTRO de la
 * transacción: bloquea la fila del proyecto (`FOR UPDATE`) antes de leer el
 * máximo actual para serializar composiciones concurrentes del mismo
 * proyecto; el unique index `(project_id, version)` queda como red de
 * seguridad si de todos modos hubiera una carrera (en ese caso el insert
 * lanza por violación de constraint — no se reintenta acá, lo maneja el
 * caller). Deja evento `page_composed` en la estación `produccion` con
 * snapshot `{version, notas}` — NUNCA el árbol completo, para no inflar el
 * evento con el jsonb grande. Devuelve id y version de la fila insertada.
 */
export function insertPageVersion(
  projectId: string,
  ownerId: string,
  data: InsertPageVersionInput,
  actor: Actor
): Promise<InsertedPageVersion> {
  return db.transaction(async (tx) => {
    const [project] = await tx
      .select({ id: pixelforgeProjects.id })
      .from(pixelforgeProjects)
      .where(and(eq(pixelforgeProjects.id, projectId), eq(pixelforgeProjects.ownerId, ownerId)))
      .for("update")
      .limit(1);
    if (!project) throw new Error("Proyecto no encontrado");

    const [latest] = await tx
      .select({ version: pixelforgePageVersions.version })
      .from(pixelforgePageVersions)
      .where(eq(pixelforgePageVersions.projectId, projectId))
      .orderBy(desc(pixelforgePageVersions.version))
      .limit(1);
    const version = computeNextPageVersion(latest);

    const [inserted] = await tx
      .insert(pixelforgePageVersions)
      .values({
        projectId,
        version,
        tree: data.tree,
        notas: data.notas,
        warnings: data.warnings,
        createdById: actor.id,
        createdByName: actor.name,
      })
      .returning({ id: pixelforgePageVersions.id, version: pixelforgePageVersions.version });

    await tx.insert(pixelforgeEvents).values({
      projectId,
      station: "produccion",
      type: "page_composed",
      actorId: actor.id,
      actorName: actor.name,
      snapshot: { version, notas: data.notas },
    });

    // F9: una versión nueva invalida cualquier revisión abierta/terminal-no-
    // cancelada anclada a la versión anterior — la aprobación (o la ronda en
    // curso) ya no aplica a la vigente. Va DENTRO de esta tx (después del
    // insert y del evento `page_composed`, para que el histórico lea "compuse
    // v N" y luego "superseder las reviews de v N-1"). Cierra la ventana de la
    // carrera approve-vs-recompose: ambas compiten por el lock `FOR UPDATE` de
    // la fila de proyecto que este `insertPageVersion` ya tomó arriba.
    await supersedeActiveReviewsInTx(tx, projectId, inserted.id, inserted.version, actor.name);

    await touchProject(tx, projectId);

    return inserted;
  });
}

/**
 * Versión vigente (mayor `version`) CON el árbol completo, ownership-checked.
 * Null si el proyecto todavía no tiene ninguna versión compuesta (pre-F7 o
 * blueprint sellado pero aún sin componer).
 */
export async function getLatestPageVersion(
  projectId: string,
  ownerId: string
): Promise<PixelforgePageVersion | null> {
  const project = await getPixelforgeProject(projectId, ownerId);
  if (!project) throw new Error("Proyecto no encontrado");

  const [latest] = await db
    .select()
    .from(pixelforgePageVersions)
    .where(eq(pixelforgePageVersions.projectId, projectId))
    .orderBy(desc(pixelforgePageVersions.version))
    .limit(1);

  return latest ?? null;
}

export interface PixelforgePageVersionMeta {
  id: string;
  version: number;
  notas: string;
  warnings: string[];
  createdByName: string;
  createdAt: Date;
}

/**
 * Metadatos de todas las versiones del proyecto para el historial de la
 * estación `produccion` — SIN `tree` (evita traer el jsonb grande de todas
 * las versiones solo para listar el historial). Ownership-checked. Orden
 * desc por `version` (la vigente primero).
 */
export async function listPageVersions(
  projectId: string,
  ownerId: string
): Promise<PixelforgePageVersionMeta[]> {
  const project = await getPixelforgeProject(projectId, ownerId);
  if (!project) throw new Error("Proyecto no encontrado");

  const rows = await db
    .select({
      id: pixelforgePageVersions.id,
      version: pixelforgePageVersions.version,
      notas: pixelforgePageVersions.notas,
      warnings: pixelforgePageVersions.warnings,
      createdByName: pixelforgePageVersions.createdByName,
      createdAt: pixelforgePageVersions.createdAt,
    })
    .from(pixelforgePageVersions)
    .where(eq(pixelforgePageVersions.projectId, projectId))
    .orderBy(desc(pixelforgePageVersions.version));

  return rows.map((row) => ({ ...row, warnings: row.warnings as string[] }));
}

/**
 * Versión de página por id exacto (como `getLatestPageVersion` pero sin
 * asumir "la vigente"). Ownership-checked (lanza si no existe/no es del
 * owner). Null si el id no corresponde a ninguna versión de ESTE proyecto.
 */
export async function getPageVersionById(
  projectId: string,
  versionId: string,
  ownerId: string
): Promise<PixelforgePageVersion | null> {
  const project = await getPixelforgeProject(projectId, ownerId);
  if (!project) throw new Error("Proyecto no encontrado");

  const [version] = await db
    .select()
    .from(pixelforgePageVersions)
    .where(
      and(
        eq(pixelforgePageVersions.id, versionId),
        eq(pixelforgePageVersions.projectId, projectId)
      )
    )
    .limit(1);

  return version ?? null;
}

// ─── QA (F8 — estación `qa`) ────────────────────────────────────────────────
// Un QA queda atado a UNA `pixelforge_page_versions` concreta para siempre
// (el ancla nunca cambia, aunque el proyecto siga componiendo versiones
// nuevas). El unique parcial `pixelforge_qa_runs_active_idx` garantiza en DB
// "un solo QA activo por proyecto" — `createQaRun` traduce su violación
// (23505) a `QaRunAlreadyActiveError` en vez de dejar subir el error crudo de
// Postgres. `claimQaBrowserJob`/`finishQaBrowserJob`/`updateQaRunProgress`/
// `sweepStaleQaRuns` son INTERNAS (sin ownerId): las invoca el motor/runner
// con un `qaRunId` ya resuelto, no directamente una action de usuario — mismo
// criterio que `claimRun`/`finishRunRecord`/`updateRunProgress` de corridas IA
// más arriba en este archivo.

/** Error tipado para que el caller distinga "ya hay un QA activo" de cualquier otra falla de escritura. */
export class QaRunAlreadyActiveError extends Error {
  constructor() {
    super("Ya hay un QA activo para este proyecto — espera a que termine o falle");
    this.name = "QaRunAlreadyActiveError";
  }
}

const QA_RUN_ACTIVE_CONSTRAINT = "pixelforge_qa_runs_active_idx";

/**
 * true si `err` es la violación del unique parcial "un solo QA activo por
 * proyecto". Drizzle envuelve el `postgres.PostgresError` original en un
 * `DrizzleQueryError` propio y lo expone en `.cause` — hay que mirar ahí, el
 * error de nivel superior nunca trae `code`/`constraint_name`.
 */
function isQaRunActiveViolation(err: unknown): boolean {
  const cause = err instanceof Error ? err.cause : undefined;
  return (
    cause instanceof postgres.PostgresError &&
    cause.code === "23505" &&
    cause.constraint_name === QA_RUN_ACTIVE_CONSTRAINT
  );
}

export interface CreateQaRunInput {
  pageVersionId: string;
  catalogVersion: string;
  scoringVersion: string;
}

export interface CreatedQaRun {
  id: string;
}

/**
 * Arranca un QA sobre una versión concreta de la landing: verifica ownership
 * del proyecto y que `pageVersionId` pertenece a ESE proyecto, inserta la
 * corrida en `queued` + evento `qa_started` (snapshot `{pageVersionId,
 * version}` — NUNCA el árbol de la versión). Si el unique parcial rechaza el
 * insert (ya hay un QA `queued`/`running` para este proyecto), lanza
 * `QaRunAlreadyActiveError` en vez del 23505 crudo de Postgres.
 */
export function createQaRun(
  projectId: string,
  ownerId: string,
  input: CreateQaRunInput,
  actor: Actor
): Promise<CreatedQaRun> {
  return db.transaction(async (tx) => {
    const [project] = await tx
      .select({ id: pixelforgeProjects.id })
      .from(pixelforgeProjects)
      .where(and(eq(pixelforgeProjects.id, projectId), eq(pixelforgeProjects.ownerId, ownerId)))
      .limit(1);
    if (!project) throw new Error("Proyecto no encontrado");

    const [pageVersion] = await tx
      .select({ version: pixelforgePageVersions.version })
      .from(pixelforgePageVersions)
      .where(
        and(
          eq(pixelforgePageVersions.id, input.pageVersionId),
          eq(pixelforgePageVersions.projectId, projectId)
        )
      )
      .limit(1);
    if (!pageVersion) throw new Error("Versión de la página no encontrada");

    let runId: string;
    try {
      const [inserted] = await tx
        .insert(pixelforgeQaRuns)
        .values({
          projectId,
          pageVersionId: input.pageVersionId,
          catalogVersion: input.catalogVersion,
          scoringVersion: input.scoringVersion,
          requestedById: actor.id,
          requestedByName: actor.name,
        })
        .returning({ id: pixelforgeQaRuns.id });
      runId = inserted.id;
    } catch (err) {
      if (isQaRunActiveViolation(err)) throw new QaRunAlreadyActiveError();
      throw err;
    }

    await tx.insert(pixelforgeEvents).values({
      projectId,
      station: "qa",
      type: "qa_started",
      actorId: actor.id,
      actorName: actor.name,
      snapshot: { pageVersionId: input.pageVersionId, version: pageVersion.version },
    });

    await touchProject(tx, projectId);

    return { id: runId };
  });
}

/** El QA `queued`/`running` del proyecto, si existe. Ownership-checked. Null si no hay ninguno activo. */
export async function getActiveQaRun(
  projectId: string,
  ownerId: string
): Promise<PixelforgeQaRun | null> {
  const project = await getPixelforgeProject(projectId, ownerId);
  if (!project) throw new Error("Proyecto no encontrado");

  const [run] = await db
    .select()
    .from(pixelforgeQaRuns)
    .where(
      and(
        eq(pixelforgeQaRuns.projectId, projectId),
        inArray(pixelforgeQaRuns.status, ["queued", "running"])
      )
    )
    .limit(1);

  return run ?? null;
}

export interface QaRunWithFindings {
  run: PixelforgeQaRun;
  findings: PixelforgeQaFinding[];
}

/**
 * Corrida de QA + sus hallazgos, ownership-checked vía join a
 * `pixelforgeProjects` (mismo patrón que `getRunForOwner`/
 * `setRunUserDecision`). Null si no existe o no es del owner.
 */
export async function getQaRunWithFindings(
  qaRunId: string,
  ownerId: string
): Promise<QaRunWithFindings | null> {
  const [row] = await db
    .select({ run: pixelforgeQaRuns })
    .from(pixelforgeQaRuns)
    .innerJoin(pixelforgeProjects, eq(pixelforgeQaRuns.projectId, pixelforgeProjects.id))
    .where(and(eq(pixelforgeQaRuns.id, qaRunId), eq(pixelforgeProjects.ownerId, ownerId)))
    .limit(1);
  if (!row) return null;

  const findings = await db
    .select()
    .from(pixelforgeQaFindings)
    .where(eq(pixelforgeQaFindings.qaRunId, qaRunId))
    .orderBy(desc(pixelforgeQaFindings.createdAt));

  return { run: row.run, findings };
}

/** Metadatos de todas las corridas de QA del proyecto (SIN findings), ownership-checked. Orden desc por `createdAt`. */
export async function listQaRunsForProject(
  projectId: string,
  ownerId: string
): Promise<PixelforgeQaRun[]> {
  const project = await getPixelforgeProject(projectId, ownerId);
  if (!project) throw new Error("Proyecto no encontrado");

  return db
    .select()
    .from(pixelforgeQaRuns)
    .where(eq(pixelforgeQaRuns.projectId, projectId))
    .orderBy(desc(pixelforgeQaRuns.createdAt));
}

export interface InsertQaFindingInput {
  checkCode: string;
  category: string;
  severity: PixelforgeQaFinding["severity"];
  blocking: boolean;
  source: string; // 'det' | 'nav' | 'heu' | 'ia'
  title: string;
  description: string;
  recommendation: string;
  evidence?: unknown;
  location?: unknown;
  locationKey: string;
}

/**
 * Batch de hallazgos de un run — INTERNA (sin ownerId, ver nota de cabecera
 * de esta sección). Dedupe vía `onConflictDoNothing` sobre el unique
 * `(qa_run_id, check_code, location_key)`: un check que produce el mismo
 * hallazgo en el mismo lugar dos veces (reintento del motor, doble pasada
 * determinista+heurística) no duplica filas. No-op si `findings` viene vacío.
 */
export async function insertQaFindings(
  qaRunId: string,
  findings: InsertQaFindingInput[]
): Promise<void> {
  if (findings.length === 0) return;

  await db
    .insert(pixelforgeQaFindings)
    .values(
      findings.map((finding) => ({
        qaRunId,
        checkCode: finding.checkCode,
        category: finding.category,
        severity: finding.severity,
        blocking: finding.blocking,
        source: finding.source,
        title: finding.title,
        description: finding.description,
        recommendation: finding.recommendation,
        evidence: finding.evidence ?? null,
        location: finding.location ?? null,
        locationKey: finding.locationKey,
      }))
    )
    .onConflictDoNothing();
}

/**
 * Reclama atómicamente el job de navegador `pending` más antiguo entre las
 * corridas `running` (`browser_status='pending' AND status='running'`):
 * `SELECT ... FOR UPDATE SKIP LOCKED` sobre el candidato más viejo dentro de
 * una transacción, luego `UPDATE` a `running` + `browser_claimed_at=now()`.
 * Calco conceptual de `claimRun` (arriba), adaptado a "elegir uno entre N"
 * en vez de "reclamar un id conocido": `SKIP LOCKED` es lo que permite que
 * varios workers del qa-runner (F8-T6) reclamen en paralelo sin pisarse.
 * INTERNA — sin ownerId (la llama el runner, no un usuario). Devuelve la
 * fila reclamada o null si no hay ningún job pendiente disponible.
 */
export async function claimQaBrowserJob(): Promise<PixelforgeQaRun | null> {
  return db.transaction(async (tx) => {
    const [candidate] = await tx
      .select({ id: pixelforgeQaRuns.id })
      .from(pixelforgeQaRuns)
      .where(
        and(eq(pixelforgeQaRuns.browserStatus, "pending"), eq(pixelforgeQaRuns.status, "running"))
      )
      .orderBy(asc(pixelforgeQaRuns.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });
    if (!candidate) return null;

    const [claimed] = await tx
      .update(pixelforgeQaRuns)
      .set({ browserStatus: "running", browserClaimedAt: new Date(), updatedAt: new Date() })
      .where(eq(pixelforgeQaRuns.id, candidate.id))
      .returning();

    return claimed ?? null;
  });
}

/**
 * Cierra el sub-estado de navegador de un job reclamado. Condicional
 * (`browser_status='running'` → outcome): si el job ya no estaba `running`
 * (p. ej. `sweepStaleQaRuns` ya lo marcó `timed_out`), no-op. INTERNA — sin
 * ownerId, sin evento propio (la fase de navegador no es un estado de
 * proyecto por sí sola; el cierre del run completo lo deciden
 * `finalizeQaRun`/`failQaRun`).
 */
export async function finishQaBrowserJob(
  qaRunId: string,
  outcome: "succeeded" | "failed" | "timed_out",
  engine?: unknown
): Promise<void> {
  await db
    .update(pixelforgeQaRuns)
    .set({
      browserStatus: outcome,
      browserFinishedAt: new Date(),
      updatedAt: new Date(),
      ...(engine !== undefined ? { engine } : {}),
    })
    .where(and(eq(pixelforgeQaRuns.id, qaRunId), eq(pixelforgeQaRuns.browserStatus, "running")));
}

/** Progreso/fase actual de una corrida de QA en curso. INTERNA — sin ownerId, mismo criterio que `updateRunProgress`. */
export async function updateQaRunProgress(
  qaRunId: string,
  progress: number,
  currentPhase: string
): Promise<void> {
  await db
    .update(pixelforgeQaRuns)
    .set({ progress, currentPhase, updatedAt: new Date() })
    .where(eq(pixelforgeQaRuns.id, qaRunId));
}

export interface FinalizeQaRunInput {
  verdict: NonNullable<PixelforgeQaRun["verdict"]>;
  scoreTotal: number;
  categoryScores: unknown;
  summary: unknown;
}

/**
 * Cierra una corrida de QA con éxito: UPDATE condicional
 * `WHERE id=... AND status='running'` → `status='succeeded'`. Idempotente —
 * si dos invocadores compiten (p. ej. reintento del orquestador), solo UNO
 * afecta una fila y deja el evento `qa_finished`; el otro ve 0 filas
 * afectadas y no hace nada (devuelve `false`). La lógica de QUÉ verdict
 * computar NO vive acá (llega en T2/T4) — esta función solo persiste el
 * resultado ya decidido. `verdict`/`scoreTotal`/etc. quedan congelados: nunca
 * se recalculan después. Devuelve `true` si ESTA llamada cerró el run.
 */
export function finalizeQaRun(
  qaRunId: string,
  result: FinalizeQaRunInput
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const now = new Date();
    const [run] = await tx
      .update(pixelforgeQaRuns)
      .set({
        status: "succeeded",
        verdict: result.verdict,
        scoreTotal: result.scoreTotal,
        categoryScores: result.categoryScores,
        summary: result.summary,
        finishedAt: now,
        updatedAt: now,
      })
      .where(and(eq(pixelforgeQaRuns.id, qaRunId), eq(pixelforgeQaRuns.status, "running")))
      .returning({
        projectId: pixelforgeQaRuns.projectId,
        requestedById: pixelforgeQaRuns.requestedById,
        requestedByName: pixelforgeQaRuns.requestedByName,
      });
    if (!run) return false; // otro invocador ya lo cerró (o no estaba running) — no-op

    await tx.insert(pixelforgeEvents).values({
      projectId: run.projectId,
      station: "qa",
      type: "qa_finished",
      actorId: run.requestedById,
      actorName: run.requestedByName,
      reason: result.verdict,
      snapshot: { verdict: result.verdict, scoreTotal: result.scoreTotal },
    });

    return true;
  });
}

/**
 * Cierra una corrida de QA con falla: UPDATE condicional
 * `WHERE id=... AND status IN ('queued','running')` → `status='failed'` —
 * mismo patrón idempotente que `finalizeQaRun` (2 filas del estado inicial
 * porque un run puede fallar ANTES de llegar a `running`, p. ej. un error de
 * setup mientras seguía `queued`). Devuelve `true` si ESTA llamada cerró el
 * run.
 */
export function failQaRun(
  qaRunId: string,
  failureKind: string,
  error: string
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const now = new Date();
    const [run] = await tx
      .update(pixelforgeQaRuns)
      .set({
        status: "failed",
        failureKind,
        error,
        finishedAt: now,
        updatedAt: now,
      })
      .where(and(eq(pixelforgeQaRuns.id, qaRunId), inArray(pixelforgeQaRuns.status, ["queued", "running"])))
      .returning({
        projectId: pixelforgeQaRuns.projectId,
        requestedById: pixelforgeQaRuns.requestedById,
        requestedByName: pixelforgeQaRuns.requestedByName,
      });
    if (!run) return false;

    await tx.insert(pixelforgeEvents).values({
      projectId: run.projectId,
      station: "qa",
      type: "qa_failed",
      actorId: run.requestedById,
      actorName: run.requestedByName,
      reason: failureKind,
      snapshot: null,
    });

    return true;
  });
}

export type QaHumanDecision = "approved" | "rejected";

/**
 * Registra la decisión humana sobre un QA `pass_with_warnings` (aprobar con
 * reservas o rechazar). Ownership del proyecto. Solo aplica si el run está
 * `succeeded` con `verdict='pass_with_warnings'` y SIN decisión previa
 * (`human_decision IS NULL`) — lanza si no es elegible (mensaje distinto de
 * "no encontrado" para no confundir 404 con "no aplica"). Evento
 * `qa_approved_with_warnings` o `qa_rejected` según `decision`.
 */
export function recordQaHumanDecision(
  qaRunId: string,
  ownerId: string,
  decision: QaHumanDecision,
  reason: string,
  actor: Actor
): Promise<void> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ projectId: pixelforgeQaRuns.projectId })
      .from(pixelforgeQaRuns)
      .innerJoin(pixelforgeProjects, eq(pixelforgeQaRuns.projectId, pixelforgeProjects.id))
      .where(and(eq(pixelforgeQaRuns.id, qaRunId), eq(pixelforgeProjects.ownerId, ownerId)))
      .limit(1);
    if (!row) throw new Error("QA no encontrado");

    const now = new Date();
    const [updated] = await tx
      .update(pixelforgeQaRuns)
      .set({
        humanDecision: decision,
        humanDecisionById: actor.id,
        humanDecisionByName: actor.name,
        humanDecisionAt: now,
        humanDecisionReason: reason,
        updatedAt: now,
      })
      .where(
        and(
          eq(pixelforgeQaRuns.id, qaRunId),
          eq(pixelforgeQaRuns.status, "succeeded"),
          eq(pixelforgeQaRuns.verdict, "pass_with_warnings"),
          isNull(pixelforgeQaRuns.humanDecision)
        )
      )
      .returning({ id: pixelforgeQaRuns.id });
    if (!updated) {
      throw new Error(
        "Este QA no admite una decisión humana — debe estar succeeded con verdict pass_with_warnings y sin decisión previa"
      );
    }

    await tx.insert(pixelforgeEvents).values({
      projectId: row.projectId,
      station: "qa",
      type: decision === "approved" ? "qa_approved_with_warnings" : "qa_rejected",
      actorId: actor.id,
      actorName: actor.name,
      reason,
      snapshot: null,
    });

    await touchProject(tx, row.projectId);
  });
}

export type QaRunStaleReason =
  | "queued_timeout"
  | "browser_claim_timeout"
  | "browser_pending_timeout"
  | "running_timeout";

/** Umbrales de staleness (ms) — ver docstring de `isStaleQaRun`. */
export const QA_QUEUED_TIMEOUT_MS = 10 * 60 * 1000;
export const QA_BROWSER_CLAIM_TIMEOUT_MS = 10 * 60 * 1000;
/**
 * PF-F8 T4 (aditivo): un run que terminó la fase 1 (`browser_status` nace/
 * queda `pending`, ver `updateQaRunProgress(qaRunId, 35, 'navegador')` en el
 * POST) pero que NINGÚN qa-runner (F8-T6, todavía no existe) reclama nunca —
 * `browser_claim_timeout` de abajo NO cubre este caso: esa condición exige
 * `browserStatus==='running'` (ya reclamado); un job que se queda `pending`
 * para siempre no la dispara nunca y solo lo atraparía `running_timeout` a
 * los 20 min. Mismo umbral de 10 min que `browser_claim_timeout`, medido
 * desde `updatedAt` (que `updateQaRunProgress` tocó al anunciar la fase
 * `navegador` — el punto de referencia natural de "cuánto lleva esperando un
 * runner").
 */
export const QA_BROWSER_PENDING_TIMEOUT_MS = 10 * 60 * 1000;
export const QA_RUNNING_TIMEOUT_MS = 20 * 60 * 1000;

export interface QaRunStalenessInput {
  status: PixelforgeQaRun["status"];
  browserStatus: PixelforgeQaRun["browserStatus"];
  createdAt: Date;
  browserClaimedAt: Date | null;
  updatedAt: Date;
}

/**
 * Función PURA (testeable sin DB, mismo patrón que
 * `computeNextPageVersion`/`assertDirectionDecisionStillCurrent`): decide si
 * un run de QA quedó "atorado" y debe marcarse como fallido. 4 condiciones,
 * en orden de chequeo (la primera que aplica gana):
 *   1. `queued` hace más de 10 min (`createdAt`) — nunca lo reclamó nadie.
 *   2. `browser_status='running'` con `browserClaimedAt` de hace más de
 *      10 min — el qa-runner externo se colgó o murió sin reportar.
 *   3. `browser_status='pending'` con `updatedAt` de hace más de 10 min
 *      (`status='running'`) — PF-F8 T4: ningún qa-runner reclamó el job
 *      nunca (ver docstring de `QA_BROWSER_PENDING_TIMEOUT_MS`); sin este
 *      chequeo el run quedaría esperando hasta `running_timeout` (20 min).
 *   4. `status='running'` hace más de 20 min (`createdAt`) — el run completo
 *      se pasó de tiempo total (determinista+navegador+ia+cierre).
 * `null` si el run está sano (o ya cerrado: `succeeded`/`failed`).
 */
export function isStaleQaRun(run: QaRunStalenessInput, now: Date): QaRunStaleReason | null {
  if (run.status === "queued" && now.getTime() - run.createdAt.getTime() > QA_QUEUED_TIMEOUT_MS) {
    return "queued_timeout";
  }
  if (
    run.browserStatus === "running" &&
    run.browserClaimedAt !== null &&
    now.getTime() - run.browserClaimedAt.getTime() > QA_BROWSER_CLAIM_TIMEOUT_MS
  ) {
    return "browser_claim_timeout";
  }
  if (
    run.status === "running" &&
    run.browserStatus === "pending" &&
    now.getTime() - run.updatedAt.getTime() > QA_BROWSER_PENDING_TIMEOUT_MS
  ) {
    return "browser_pending_timeout";
  }
  if (run.status === "running" && now.getTime() - run.createdAt.getTime() > QA_RUNNING_TIMEOUT_MS) {
    return "running_timeout";
  }
  return null;
}

/**
 * Barre runs de QA atorados y los cierra: `queued`/`running` candidatos se
 * evalúan con `isStaleQaRun` (función pura de arriba); si aplica
 * `browser_claim_timeout`, primero se marca `browser_status='timed_out'`
 * (condicional a que siga `running` — no pisa un cierre concurrente del
 * runner real) y luego, en TODOS los casos que aplican, se cierra el run
 * completo vía `failQaRun` (mismo patrón idempotente: 2 invocaciones
 * concurrentes de `sweepStaleQaRuns` no producen 2 eventos `qa_failed`).
 * `projectId` opcional acota el barrido a un solo proyecto (usado por tests/
 * scripts de verificación); sin él, barre TODOS los proyectos. INTERNA — la
 * llama un cron/worker, no una action de usuario. Devuelve cuántos runs
 * cerró ESTA llamada.
 */
export async function sweepStaleQaRuns(projectId?: string): Promise<number> {
  const now = new Date();
  const candidates = await db
    .select()
    .from(pixelforgeQaRuns)
    .where(
      and(
        inArray(pixelforgeQaRuns.status, ["queued", "running"]),
        projectId ? eq(pixelforgeQaRuns.projectId, projectId) : undefined
      )
    );

  let swept = 0;
  for (const run of candidates) {
    const reason = isStaleQaRun(run, now);
    if (!reason) continue;

    if (reason === "browser_claim_timeout") {
      await db
        .update(pixelforgeQaRuns)
        .set({ browserStatus: "timed_out", browserFinishedAt: now, updatedAt: now })
        .where(and(eq(pixelforgeQaRuns.id, run.id), eq(pixelforgeQaRuns.browserStatus, "running")));
    } else if (reason === "browser_pending_timeout") {
      // Mismo criterio que `browser_claim_timeout` arriba (condicional al
      // browserStatus que disparó la staleness — no pisa un claim real que
      // haya llegado justo entre `isStaleQaRun` y este UPDATE).
      await db
        .update(pixelforgeQaRuns)
        .set({ browserStatus: "timed_out", browserFinishedAt: now, updatedAt: now })
        .where(and(eq(pixelforgeQaRuns.id, run.id), eq(pixelforgeQaRuns.browserStatus, "pending")));
    }

    const closed = await failQaRun(run.id, "timeout", `QA marcado como fallido por inactividad (${reason})`);
    if (closed) swept += 1;
  }

  return swept;
}

// ─── QA — orquestación (F8-T4) ──────────────────────────────────────────────
// Todo lo de abajo es INTERNO (sin ownerId, mismo criterio que
// `claimQaBrowserJob`/`updateQaRunProgress`/`sweepStaleQaRuns` arriba): lo
// invoca el POST de arranque, `finalizeQaRunOrchestrated`
// (`src/lib/pixelforge/qa/finalize.ts`) o la ruta de decisión humana — nunca
// directamente con un `ownerId` sin resolver. La verificación de ownership ya
// ocurrió en la ruta que resolvió el `qaRunId`/`projectId` antes de llegar
// acá.

/**
 * Transiciona un QA de `queued` a `running` y marca el `currentPhase` inicial
 * — lo llama UNA vez el fire-and-forget del POST que dispara la fase 1
 * (determinista+heurística). A diferencia de `claimRun` (corridas IA), un
 * `qa_run` no tiene varios workers compitiendo por reclamarlo (el propio POST
 * lo dispara inline, ya protegido por el unique parcial "un solo QA activo
 * por proyecto") — por eso esto no devuelve un booleano de "gané el claim":
 * el WHERE condicional a `status='queued'` es solo defensa en profundidad, no
 * un mecanismo de concurrencia real.
 */
export async function startQaRunPhase1(qaRunId: string): Promise<void> {
  await db
    .update(pixelforgeQaRuns)
    .set({ status: "running", currentPhase: "determinista", updatedAt: new Date() })
    .where(and(eq(pixelforgeQaRuns.id, qaRunId), eq(pixelforgeQaRuns.status, "queued")));
}

/** Corrida de QA por id, SIN ownership check. `null` si no existe. */
export async function getQaRunById(qaRunId: string): Promise<PixelforgeQaRun | null> {
  const [run] = await db.select().from(pixelforgeQaRuns).where(eq(pixelforgeQaRuns.id, qaRunId)).limit(1);
  return run ?? null;
}

/** Hallazgos de una corrida de QA, SIN ownership check. Orden desc por `createdAt` (mismo orden que `getQaRunWithFindings`). */
export async function getQaFindingsForRun(qaRunId: string): Promise<PixelforgeQaFinding[]> {
  return db
    .select()
    .from(pixelforgeQaFindings)
    .where(eq(pixelforgeQaFindings.qaRunId, qaRunId))
    .orderBy(desc(pixelforgeQaFindings.createdAt));
}

/** Versión de página por id, SIN ownership check (`getPageVersionById` exige projectId+ownerId — esta variante la usa `finalizeQaRunOrchestrated`, que corre server-internal sin ninguno de los dos). `null` si no existe. */
export async function getPageVersionInternal(pageVersionId: string): Promise<PixelforgePageVersion | null> {
  const [version] = await db
    .select()
    .from(pixelforgePageVersions)
    .where(eq(pixelforgePageVersions.id, pageVersionId))
    .limit(1);
  return version ?? null;
}

/** `version` más alta del proyecto (solo el número, SIN el árbol ni ownership check) — la usa `finalizeQaRunOrchestrated` para decidir si la versión evaluada por un QA quedó obsoleta (`buildStaleVersionFinding`, T2). `null` si el proyecto no tiene ninguna versión. */
export async function getLatestPageVersionNumber(projectId: string): Promise<number | null> {
  const [latest] = await db
    .select({ version: pixelforgePageVersions.version })
    .from(pixelforgePageVersions)
    .where(eq(pixelforgePageVersions.projectId, projectId))
    .orderBy(desc(pixelforgePageVersions.version))
    .limit(1);
  return latest?.version ?? null;
}

/** Forma mínima de la dirección `chosen` de un proyecto que necesita `runDeterministicChecks` (T2). */
export interface ChosenDirectionForQa {
  designTokens: unknown;
  motionDna: unknown;
  status: PixelforgeCreativeDirection["status"];
}

/**
 * Dirección `chosen` ACTUAL del proyecto (vía `projects.chosenDirectionId`),
 * SIN ownership check. La usa `finalizeQaRunOrchestrated` para recalcular
 * barato `checksSkipped`/`treeUsesCapabilities` (`runDeterministicChecks`,
 * T2) al cerrar un run — nota: si el usuario cambia de dirección elegida
 * MIENTRAS un QA está en curso (ventana angosta, no protegida por lock), este
 * recompute puede ver una dirección distinta a la que vio la fase 1; no
 * afecta el veredicto/score real (ya persistidos en fase 1), solo la
 * metadata informativa del cierre. `null` si el proyecto no existe o no
 * tiene ninguna dirección elegida.
 */
export async function getChosenDirectionForProject(projectId: string): Promise<ChosenDirectionForQa | null> {
  const [project] = await db
    .select({ chosenDirectionId: pixelforgeProjects.chosenDirectionId })
    .from(pixelforgeProjects)
    .where(eq(pixelforgeProjects.id, projectId))
    .limit(1);
  if (!project?.chosenDirectionId) return null;

  const [direction] = await db
    .select({
      designTokens: pixelforgeCreativeDirections.designTokens,
      motionDna: pixelforgeCreativeDirections.motionDna,
      status: pixelforgeCreativeDirections.status,
    })
    .from(pixelforgeCreativeDirections)
    .where(eq(pixelforgeCreativeDirections.id, project.chosenDirectionId))
    .limit(1);
  return direction ?? null;
}

/**
 * Status de un lote de corridas IA por id (`Map<id, status>`), SIN ownership
 * check — la usa `finalizeQaRunOrchestrated` para saber si las 3 corridas
 * advisory (`critiqueRunId`/`originalityRunId`/`likenessRunId`, T5) ya
 * terminaron. `[]` de entrada devuelve un Map vacío sin tocar la DB.
 */
export async function getAiRunStatuses(runIds: string[]): Promise<Map<string, PixelforgeAiRun["status"]>> {
  if (runIds.length === 0) return new Map();
  const rows = await db
    .select({ id: pixelforgeAiRuns.id, status: pixelforgeAiRuns.status })
    .from(pixelforgeAiRuns)
    .where(inArray(pixelforgeAiRuns.id, runIds));
  return new Map(rows.map((row) => [row.id, row.status]));
}

/** Actor laxo para `openQaGate` — `id` puede ser `null` (el `requestedById` original del run puede haberse limpiado por `onDelete: set null` si el usuario fue borrado); cualquier `Actor` real (`id: string`) satisface esto igual. */
export interface QaGateActor {
  id: string | null;
  name: string;
}

/** Resultado de {@link openQaGate} — reemplaza el `Promise<void>` original (review final PF-F8, finding 1): el llamador necesita distinguir POR QUÉ no se abrió, no solo que no pasó nada. */
export interface OpenQaGateResult {
  opened: boolean;
  /**
   * Presente únicamente cuando `opened` es `false` Y la causa fue que la
   * `page_version` evaluada por este `qa_run` dejó de ser la vigente del
   * proyecto (releído DENTRO de la tx — ver docstring de la función).
   * Ausente en la otra causa posible de `opened:false` (el proyecto ya
   * avanzó más allá de `produccion`/`qa`, o ya está en `revision`): ningún
   * llamador reacciona distinto a esa segunda causa hoy, así que no se
   * modela con un valor propio.
   */
  reason?: "stale-version";
}

/**
 * Criterio puro de "¿la versión que evaluó este qa_run dejó de ser la
 * vigente?" — extraído de `openQaGate` (mismo criterio que
 * `hasAdvisoryRunsAttached`/`isStaleQaRun` en este archivo: la decisión se
 * separa de la query de DB para poder testearla sin infra de DB). `null` en
 * `latestVersion` significa "el proyecto no tiene NINGUNA page_version" —no
 * debería pasar dentro de la tx de `openQaGate` (el propio `qa_run` referencia
 * una), pero se trata como "no stale" para no bloquear el gate por un dato
 * ausente/anómalo — mismo criterio que usa `buildStaleVersionFinding` con su
 * `?? pageVersion.version`.
 */
export function isQaGateVersionStale(evaluatedVersion: number, latestVersion: number | null): boolean {
  return latestVersion !== null && latestVersion !== evaluatedVersion;
}

/**
 * Abre la compuerta hacia la estación `revision`: evento `qa_gate_opened`
 * (snapshot `{qaRunId, verdict, pageVersionId, version}` — NUNCA
 * tree/findings completos) + `UPDATE pixelforge_projects SET
 * current_station='revision' WHERE id=... AND current_station IN
 * ('produccion','qa')` (el `IN` es la compuerta real: no retrocede si el
 * proyecto ya avanzó más allá, ni la abre dos veces si ya está en
 * `revision`). El evento SOLO se inserta si ese UPDATE afectó 1 fila (finding
 * 2, review final PF-F8) — antes se insertaba incondicionalmente, duplicando
 * `qa_gate_opened` si el proyecto ya había pasado de estación.
 *
 * Guard TOCTOU (finding 1, review final PF-F8): antes de tocar nada, releída
 * DENTRO de esta misma tx —bajo el lock de la fila de proyecto que toma
 * abajo, mismo recurso que bloquea `insertPageVersion`— la versión vigente
 * del proyecto. Si ya no coincide con la `page_version` que evaluó este
 * `qa_run`, la función NO abre el gate (ni evento ni UPDATE) y devuelve
 * `{opened: false, reason: 'stale-version'}`. Esto cierra la ventana real:
 * antes, `finalize.ts` y `decision/route.ts` verificaban la vigencia FUERA de
 * esta transacción, dejando un hueco donde un `compose_page_tree` (F7) podía
 * aterrizar una versión nueva ENTRE ese chequeo externo y esta llamada,
 * avanzando el proyecto a `revision` sobre una versión que nunca pasó QA. El
 * lock de la fila de proyecto (`.for("update")`, calco de `insertPageVersion`)
 * es lo que hace la relectura confiable: si `insertPageVersion` está
 * insertando una versión nueva EN ESTE MOMENTO, ambas tx compiten por el
 * mismo lock y se serializan — cualquiera que gane, la relectura de abajo ve
 * el estado post-lock consistente, nunca un estado a mitad de camino.
 *
 * La invoca `finalizeQaRunOrchestrated` (verdict `pass`) y la ruta de
 * decisión humana (verdict `pass_with_warnings` aprobado) — ambas pueden
 * seguir haciendo su propio chequeo de vigencia FUERA de la tx como UX
 * temprana (evitar trabajo/dar un 409 rápido), pero la garantía real vive
 * acá, no ahí. Lanza si `qaRunId` no existe o su `pageVersionId` no resuelve
 * (no debería pasar: ambos son invariantes de FK NOT NULL), o si `projectId`
 * no resuelve a un proyecto existente.
 */
export function openQaGate(projectId: string, qaRunId: string, actor: QaGateActor): Promise<OpenQaGateResult> {
  return db.transaction(async (tx) => {
    // Lock de la fila de proyecto — MISMO recurso que `insertPageVersion`
    // bloquea con su propio `.for("update")` (ver docstring de arriba): esto
    // es lo que serializa esta función contra una composición concurrente de
    // una versión nueva, en vez de solo esperar tener suerte con el timing.
    const [project] = await tx
      .select({ id: pixelforgeProjects.id })
      .from(pixelforgeProjects)
      .where(eq(pixelforgeProjects.id, projectId))
      .for("update")
      .limit(1);
    if (!project) throw new Error("Proyecto no encontrado");

    const [row] = await tx
      .select({
        verdict: pixelforgeQaRuns.verdict,
        pageVersionId: pixelforgeQaRuns.pageVersionId,
        version: pixelforgePageVersions.version,
      })
      .from(pixelforgeQaRuns)
      .innerJoin(pixelforgePageVersions, eq(pixelforgeQaRuns.pageVersionId, pixelforgePageVersions.id))
      .where(eq(pixelforgeQaRuns.id, qaRunId))
      .limit(1);
    if (!row) throw new Error("QA no encontrado");

    // Relectura de la versión vigente, FRESCA dentro de esta tx y bajo el
    // lock de arriba — la única fuente de verdad real de si este qa_run
    // sigue aplicando (no lo que el llamador haya visto antes de invocar
    // esta función).
    const [latest] = await tx
      .select({ version: pixelforgePageVersions.version })
      .from(pixelforgePageVersions)
      .where(eq(pixelforgePageVersions.projectId, projectId))
      .orderBy(desc(pixelforgePageVersions.version))
      .limit(1);
    if (isQaGateVersionStale(row.version, latest?.version ?? null)) {
      return { opened: false, reason: "stale-version" };
    }

    const updated = await tx
      .update(pixelforgeProjects)
      .set({ currentStation: "revision", updatedAt: new Date() })
      .where(
        and(eq(pixelforgeProjects.id, projectId), inArray(pixelforgeProjects.currentStation, ["produccion", "qa"]))
      )
      .returning({ id: pixelforgeProjects.id });
    if (updated.length === 0) {
      // El proyecto ya avanzó más allá de produccion/qa, o ya está en
      // revision — mismo criterio que el `IN` de siempre, pero ahora sin
      // insertar el evento de abajo (finding 2): antes se insertaba igual,
      // duplicando `qa_gate_opened` si alguien reinvocaba esto sobre un
      // proyecto que ya había pasado de estación.
      return { opened: false };
    }

    await tx.insert(pixelforgeEvents).values({
      projectId,
      station: "qa",
      type: "qa_gate_opened",
      actorId: actor.id,
      actorName: actor.name,
      snapshot: { qaRunId, verdict: row.verdict, pageVersionId: row.pageVersionId, version: row.version },
    });

    return { opened: true };
  });
}

/** Semilla de una de las 3 corridas advisory — lo que `attachQaAdvisoryRuns` necesita para insertar su `pixelforge_ai_runs`. */
export interface AdvisoryRunSeed {
  operation: PixelforgeAIOperation;
  model: string;
  promptVersion: string;
  inputSummary: unknown;
}

export interface AttachQaAdvisoryRunsInput {
  projectId: string;
  actor: Actor;
  critique: AdvisoryRunSeed;
  originality: AdvisoryRunSeed;
  likeness: AdvisoryRunSeed;
}

export interface AttachedQaAdvisoryRuns {
  critiqueRunId: string;
  originalityRunId: string;
  likenessRunId: string;
}

/**
 * Sentinel interno para abortar la transacción de `attachQaAdvisoryRuns`
 * cuando el UPDATE final del doble cinturón (ver más abajo) afecta 0 filas.
 * Lanzarlo dentro de `db.transaction` fuerza el rollback de los 3 inserts ya
 * hechos; se atrapa FUERA de la transacción (nunca se propaga al caller) para
 * que la función siga devolviendo el mismo shape de no-op idempotente
 * (`null`) en vez de un error — el caller no puede distinguir "ya lanzada
 * por mí" de "ya lanzada por otro", y no debería tener que hacerlo.
 */
class AttachQaAdvisoryRunsRaceLostError extends Error {}

/**
 * true si el `qa_run` ya tiene cualquiera de los 3 FKs advisory seteado — el
 * criterio de no-op idempotente de `attachQaAdvisoryRuns`, extraído a función
 * pura para poder testearlo sin DB (mismo patrón que `isStaleQaRun`/
 * `assertDirectionDecisionStillCurrent` en este archivo).
 */
export function hasAdvisoryRunsAttached(run: {
  critiqueRunId: string | null;
  originalityRunId: string | null;
  likenessRunId: string | null;
}): boolean {
  return run.critiqueRunId !== null || run.originalityRunId !== null || run.likenessRunId !== null;
}

/**
 * Crea los 3 `ai_runs` (`queued`) de la fase advisory de un `qa_run` Y setea
 * sus FKs (`critique_run_id`/`originality_run_id`/`likeness_run_id`) EN UNA
 * MISMA transacción — los 3 FKs nunca quedan parcialmente seteados (F8-T5:
 * T4 lo dejó como pregunta abierta, esta función es la respuesta). Idempotente:
 * si CUALQUIER FK advisory ya está seteado (releído FRESCO dentro de esta
 * misma tx, no un valor que el caller pudo haber visto antes de invocarla),
 * es no-op y devuelve `null` — protege contra doble lanzamiento si
 * `launchQaAdvisoryRuns` (`src/lib/pixelforge/qa/advisory.ts`) se invocara dos
 * veces (p.ej. un reintento del POST que la dispara). `resultRef` de cada
 * `ai_run` queda `qa_run:<qaRunId>` (no un artifact — el resultado vive como
 * findings de este run de QA, ver `qa/advisory-operations.ts`).
 *
 * Doble cinturón contra la carrera de dos invocaciones concurrentes (revisión
 * PF-F8 T5): un SELECT simple + UPDATE incondicional dejaría que ambas
 * invocaciones leyeran los 3 FKs en null, insertaran sus propios 6 `ai_runs`
 * (3 huérfanos ejecutando contra Anthropic para nada) y se pisaran el FK
 * final con quien terminara último.
 * 1. El SELECT inicial usa `.for("update")` (calco de `insertPageVersion`):
 *    bloquea la fila del `qa_run` hasta que esta tx termine, así una segunda
 *    invocación concurrente espera y, al re-leer, ya ve los FKs seteados por
 *    la primera (no-op vía el chequeo de abajo).
 * 2. El UPDATE final igual se condiciona (`id` + `status='running'` + los 3
 *    FKs `IS NULL`) y se verifica el rowcount: si afecta 0 filas —alguien más
 *    ganó la carrera, o el `qa_run` ya no está `running`— se lanza el
 *    sentinel de arriba para revertir los 3 inserts (nunca quedan `ai_runs`
 *    huérfanos) y la función devuelve `null`.
 * El (2) es cinturón, no el mecanismo principal: bajo el lock de (1) nunca
 * debería afectar 0 filas en la práctica, pero cubre isolation levels menos
 * estrictos o cualquier cambio futuro que quite el lock sin notar esta
 * dependencia.
 *
 * INTERNA (sin ownerId) — mismo criterio que el resto de la sección de
 * orquestación de QA (`startQaRunPhase1`/`getQaRunById`/etc.): la invoca
 * `launchQaAdvisoryRuns`, nunca directamente una action de usuario. Sin
 * evento `pixelforge_events` propio (a diferencia de `createRun`) — mismo
 * criterio que `claimQaBrowserJob`/`updateQaRunProgress`: es orquestación
 * interna del motor de QA, no una acción que un actor humano disparó
 * directamente.
 */
export async function attachQaAdvisoryRuns(
  qaRunId: string,
  input: AttachQaAdvisoryRunsInput
): Promise<AttachedQaAdvisoryRuns | null> {
  try {
    return await db.transaction(async (tx) => {
      const [run] = await tx
        .select({
          critiqueRunId: pixelforgeQaRuns.critiqueRunId,
          originalityRunId: pixelforgeQaRuns.originalityRunId,
          likenessRunId: pixelforgeQaRuns.likenessRunId,
        })
        .from(pixelforgeQaRuns)
        .where(eq(pixelforgeQaRuns.id, qaRunId))
        .for("update")
        .limit(1);
      if (!run) return null;
      if (hasAdvisoryRunsAttached(run)) {
        return null; // ya lanzada — no-op idempotente.
      }

      async function insertAdvisoryRun(seed: AdvisoryRunSeed): Promise<string> {
        const [inserted] = await tx
          .insert(pixelforgeAiRuns)
          .values({
            projectId: input.projectId,
            operation: seed.operation,
            status: "queued",
            model: seed.model,
            promptVersion: seed.promptVersion,
            inputSummary: seed.inputSummary,
            resultRef: `qa_run:${qaRunId}`,
            requestedById: input.actor.id,
            requestedByName: input.actor.name,
          })
          .returning({ id: pixelforgeAiRuns.id });
        return inserted.id;
      }

      const critiqueRunId = await insertAdvisoryRun(input.critique);
      const originalityRunId = await insertAdvisoryRun(input.originality);
      const likenessRunId = await insertAdvisoryRun(input.likeness);

      const updated = await tx
        .update(pixelforgeQaRuns)
        .set({ critiqueRunId, originalityRunId, likenessRunId, updatedAt: new Date() })
        .where(
          and(
            eq(pixelforgeQaRuns.id, qaRunId),
            eq(pixelforgeQaRuns.status, "running"),
            isNull(pixelforgeQaRuns.critiqueRunId),
            isNull(pixelforgeQaRuns.originalityRunId),
            isNull(pixelforgeQaRuns.likenessRunId)
          )
        )
        .returning({ id: pixelforgeQaRuns.id });
      if (updated.length === 0) {
        throw new AttachQaAdvisoryRunsRaceLostError();
      }

      return { critiqueRunId, originalityRunId, likenessRunId };
    });
  } catch (err) {
    if (err instanceof AttachQaAdvisoryRunsRaceLostError) return null;
    throw err;
  }
}

/**
 * `ownerId` de un proyecto por id, SIN ownership check (INTERNA — mismo
 * criterio que `getPageVersionInternal`/`claimQaBrowserJob`): la usa el
 * qa-runner (F8-T6) para construir el payload de `signQaPreviewToken`, que
 * necesita la identidad de ownership completa del proyecto, no solo el
 * `requestedById` de quien encoló el QA (que en teoría coincide, pero el
 * runner no debe asumirlo — lee la fuente real). `null` si el proyecto no
 * existe.
 */
export async function getProjectOwnerIdInternal(projectId: string): Promise<string | null> {
  const [project] = await db
    .select({ ownerId: pixelforgeProjects.ownerId })
    .from(pixelforgeProjects)
    .where(eq(pixelforgeProjects.id, projectId))
    .limit(1);
  return project?.ownerId ?? null;
}

export interface InsertQaScreenshotAssetInput {
  url: string;
  r2Key: string;
  contentType: string;
  sizeBytes: number;
}

/**
 * Registra en `pixelforge_assets` (kind `qa_screenshot`) una captura YA
 * subida a R2 por el qa-runner (F8-T6). INTERNA — sin ownerId/Actor de sesión
 * (calco de `claimQaBrowserJob`/`finishQaBrowserJob`: la invoca el runner, no
 * una action de usuario); `uploadedById` queda `null` (no hay un `users.id`
 * real detrás de un proceso automatizado) y `uploadedByName` fijo
 * `"qa-runner"` — mismo patrón desnormalizado que el resto de `pixelforge_assets`,
 * sin FK opcional huérfana. Devuelve el id del asset para
 * `evidence.screenshotAssetId` en los findings que lo referencien.
 */
export async function insertQaScreenshotAsset(
  projectId: string,
  input: InsertQaScreenshotAssetInput
): Promise<string> {
  const [asset] = await db
    .insert(pixelforgeAssets)
    .values({
      projectId,
      kind: "qa_screenshot",
      url: input.url,
      r2Key: input.r2Key,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      uploadedById: null,
      uploadedByName: "qa-runner",
    })
    .returning({ id: pixelforgeAssets.id });

  return asset.id;
}

// ─── Revisión (F9 — estación `revision`) ───────────────────────────────────
// T1 solo sienta la lectura ownership-checked sobre `pixelforge_reviews`/
// `pixelforge_review_comments` (la escritura — abrir revisión, comentar,
// aprobar/rechazar — llega en tasks posteriores de F9). Mismo calco IDOR que
// la sección QA (F8): `getPixelforgeProject`/join a `pixelforgeProjects` para
// validar ownership, `countOpenBlockingComments` queda INTERNA (sin ownerId)
// porque la invoca el guard de aprobación con un `projectId` ya resuelto
// desde una revisión ownership-checked, no directamente una action de
// usuario — mismo criterio que `claimQaBrowserJob`/`getProjectOwnerIdInternal`.

/** Todas las revisiones del proyecto (SIN comentarios), ownership-checked. Orden desc por `roundNumber`. */
export async function listReviewsForProject(
  projectId: string,
  ownerId: string
): Promise<PixelforgeReview[]> {
  const project = await getPixelforgeProject(projectId, ownerId);
  if (!project) throw new Error("Proyecto no encontrado");

  return db
    .select()
    .from(pixelforgeReviews)
    .where(eq(pixelforgeReviews.projectId, projectId))
    .orderBy(desc(pixelforgeReviews.roundNumber));
}

/** La revisión `in_review` del proyecto, si existe. Ownership-checked. Null si no hay ninguna activa. */
export async function getActiveReview(
  projectId: string,
  ownerId: string
): Promise<PixelforgeReview | null> {
  const project = await getPixelforgeProject(projectId, ownerId);
  if (!project) throw new Error("Proyecto no encontrado");

  const [review] = await db
    .select()
    .from(pixelforgeReviews)
    .where(and(eq(pixelforgeReviews.projectId, projectId), eq(pixelforgeReviews.status, "in_review")))
    .limit(1);

  return review ?? null;
}

export interface ReviewWithComments {
  review: PixelforgeReview;
  comments: PixelforgeReviewComment[];
}

/**
 * Revisión + sus comentarios, ownership-checked vía join a
 * `pixelforgeProjects` (mismo patrón que `getQaRunWithFindings`). Null si no
 * existe o no es del owner. Comentarios en orden asc por `createdAt`
 * (cronológico — a diferencia de los findings de QA, que van desc).
 */
export async function getReviewWithComments(
  reviewId: string,
  ownerId: string
): Promise<ReviewWithComments | null> {
  const [row] = await db
    .select({ review: pixelforgeReviews })
    .from(pixelforgeReviews)
    .innerJoin(pixelforgeProjects, eq(pixelforgeReviews.projectId, pixelforgeProjects.id))
    .where(and(eq(pixelforgeReviews.id, reviewId), eq(pixelforgeProjects.ownerId, ownerId)))
    .limit(1);
  if (!row) return null;

  const comments = await db
    .select()
    .from(pixelforgeReviewComments)
    .where(eq(pixelforgeReviewComments.reviewId, reviewId))
    .orderBy(asc(pixelforgeReviewComments.createdAt));

  return { review: row.review, comments };
}

/** Todos los comentarios del proyecto (de cualquier revisión), ownership-checked. Orden asc por `createdAt`. */
export async function listCommentsForProject(
  projectId: string,
  ownerId: string
): Promise<PixelforgeReviewComment[]> {
  const project = await getPixelforgeProject(projectId, ownerId);
  if (!project) throw new Error("Proyecto no encontrado");

  return db
    .select()
    .from(pixelforgeReviewComments)
    .where(eq(pixelforgeReviewComments.projectId, projectId))
    .orderBy(asc(pixelforgeReviewComments.createdAt));
}

/**
 * Cuántos comentarios bloqueantes siguen `open` en el proyecto — INTERNA (sin
 * ownerId, ver nota de cabecera de esta sección): la usa el guard de
 * aprobación de una revisión ya resuelta por id/ownership, no una action de
 * usuario directa. Se apoya en `pixelforge_review_comments_blocking_open_idx`
 * (parcial `blocking = true and status = 'open'`) para resolver con un solo
 * índice, gracias al `projectId` desnormalizado en la tabla.
 */
export async function countOpenBlockingComments(projectId: string): Promise<number> {
  const rows = await db
    .select({ id: pixelforgeReviewComments.id })
    .from(pixelforgeReviewComments)
    .where(
      and(
        eq(pixelforgeReviewComments.projectId, projectId),
        eq(pixelforgeReviewComments.blocking, true),
        eq(pixelforgeReviewComments.status, "open")
      )
    );
  return rows.length;
}

// ─── Revisión (F9) — capa transaccional ─────────────────────────────────────
// Escritura de la estación `revision`. Patrón de lock OBLIGATORIO (calco de
// `insertPageVersion`/`openQaGate`): toda operación que decide sobre el estado
// del proyecto o de una review toma `SELECT ... FOR UPDATE` sobre la fila de
// `pixelforge_projects` DENTRO de la tx — el mismo recurso que serializa la
// composición de versiones y la apertura del gate, así una `insertPageVersion`
// concurrente (que supersede reviews) y un `approveReview` no se pisan. Las
// operaciones que NO tocan estaciones ni compiten con recompose (comentar,
// resolver, cancelar) omiten el lock y confían en su propio CAS
// (`WHERE ... status=<esperado>` + rowcount) para la atomicidad.

/**
 * Error tipado de conflicto de concurrencia sobre una review/comentario — un
 * CAS (`UPDATE ... WHERE status=<esperado>`) que afectó 0 filas porque otro
 * actor (doble clic, carrera) ya cambió el estado. Lo distingue de un error de
 * validación para que la capa de route lo mapee a 409 (no 400/500).
 */
export class ReviewConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewConflictError";
  }
}

/** Mensaje es-ES accionable para un gate de QA cerrado (por qué no se puede abrir revisión). */
function reviewGateClosedMessage(reason: QaGateClosedReason | null): string {
  switch (reason) {
    case "no_qa":
      return "La versión vigente todavía no pasó QA; no se puede abrir revisión.";
    case "fail":
      return "El QA de la versión vigente resultó en fail; corrige y vuelve a ejecutar QA antes de revisar.";
    case "pending_decision":
      return "El QA pasó con advertencias pero falta la decisión humana antes de abrir revisión.";
    case "rejected":
      return "El QA con advertencias fue rechazado; no se puede abrir revisión.";
    case "stale":
      return "El QA más reciente es de una versión anterior; re-ejecuta QA sobre la versión vigente antes de revisar.";
    default:
      return "La compuerta de QA no está abierta; no se puede abrir revisión.";
  }
}

/** true si el `tree` de una page_version contiene un nodo con ese `nodeId` (`tree.nodes[].nodeId`, ver `compose-page-tree.ts`). */
function treeHasNode(tree: unknown, nodeId: string): boolean {
  if (tree === null || typeof tree !== "object") return false;
  const nodes = (tree as { nodes?: unknown }).nodes;
  if (!Array.isArray(nodes)) return false;
  return nodes.some(
    (n) => n !== null && typeof n === "object" && (n as { nodeId?: unknown }).nodeId === nodeId
  );
}

/**
 * Abre una revisión humana sobre la versión vigente del proyecto — SOLO si el
 * gate de QA está abierto para ella (mismo criterio que `computeQaGateState`).
 * Ownership + lock del proyecto; ancla la review al `qa_run` que abrió el gate
 * y congela un snapshot del veredicto/score/hash-de-árbol. `roundNumber`
 * incremental por proyecto, calculado bajo el lock (calco de
 * `computeNextPageVersion`). El unique parcial `..._active_idx` es la red final
 * contra dos reviews activas; el guard de abajo da el error accionable antes de
 * llegar a la violación de constraint.
 */
export function openReview(projectId: string, ownerId: string, actor: Actor): Promise<PixelforgeReview> {
  return db.transaction(async (tx) => {
    // (1) ownership + lock del proyecto — mismo recurso que insertPageVersion.
    const [project] = await tx
      .select({ id: pixelforgeProjects.id })
      .from(pixelforgeProjects)
      .where(and(eq(pixelforgeProjects.id, projectId), eq(pixelforgeProjects.ownerId, ownerId)))
      .for("update")
      .limit(1);
    if (!project) throw new Error("Proyecto no encontrado");

    // (2) versión vigente (max version).
    const [vigente] = await tx
      .select()
      .from(pixelforgePageVersions)
      .where(eq(pixelforgePageVersions.projectId, projectId))
      .orderBy(desc(pixelforgePageVersions.version))
      .limit(1);
    if (!vigente) throw new Error("No hay versión que revisar");

    // (3) gate de QA sobre la vigente.
    const runs = await tx
      .select()
      .from(pixelforgeQaRuns)
      .where(eq(pixelforgeQaRuns.projectId, projectId))
      .orderBy(desc(pixelforgeQaRuns.createdAt));
    const gate = computeQaGateState(runs, vigente.id);
    if (!gate.open || !gate.currentVersionRun) {
      throw new Error(reviewGateClosedMessage(gate.reason));
    }
    const run = gate.currentVersionRun;
    if (run.verdict === null || run.scoreTotal === null) {
      throw new Error("El QA anclado no tiene veredicto resuelto");
    }

    // (4) sin review activa (el unique parcial es la red).
    const [active] = await tx
      .select({ id: pixelforgeReviews.id })
      .from(pixelforgeReviews)
      .where(and(eq(pixelforgeReviews.projectId, projectId), eq(pixelforgeReviews.status, "in_review")))
      .limit(1);
    if (active) throw new Error("Ya hay una revisión activa para este proyecto");

    // (5) roundNumber = max(round_number) + 1 (bajo el lock).
    const [lastRound] = await tx
      .select({ roundNumber: pixelforgeReviews.roundNumber })
      .from(pixelforgeReviews)
      .where(eq(pixelforgeReviews.projectId, projectId))
      .orderBy(desc(pixelforgeReviews.roundNumber))
      .limit(1);
    const roundNumber = (lastRound?.roundNumber ?? 0) + 1;

    // (6) hash canónico del árbol vigente.
    const treeHash = computeTreeHash(vigente.tree);

    // (7) INSERT.
    const [review] = await tx
      .insert(pixelforgeReviews)
      .values({
        projectId,
        pageVersionId: vigente.id,
        qaRunId: run.id,
        roundNumber,
        status: "in_review",
        verdictSnapshot: run.verdict,
        scoreSnapshot: run.scoreTotal,
        treeHash,
        openedById: actor.id,
        openedByName: actor.name,
      })
      .returning();

    // (8) evento.
    await tx.insert(pixelforgeEvents).values({
      projectId,
      station: "revision",
      type: "review_opened",
      actorId: actor.id,
      actorName: actor.name,
      snapshot: {
        reviewId: review.id,
        roundNumber,
        pageVersionId: vigente.id,
        version: vigente.version,
        qaRunId: run.id,
        verdict: run.verdict,
        scoreTotal: run.scoreTotal,
        treeHash,
      },
    });

    await touchProject(tx, projectId);
    return review;
  });
}

export interface AddReviewCommentInput {
  anchorType: "general" | "section" | "finding";
  nodeId?: string;
  findingId?: string;
  body: string;
  blocking: boolean;
}

/**
 * Agrega un comentario a una revisión ABIERTA (`in_review`). Ownership vía
 * review→project. Valida el ancla server-side: `section` exige que `nodeId`
 * exista en el `tree` de la page_version anclada; `finding` exige que el
 * finding exista Y pertenezca al `qaRunId` anclado (ESCOPADO — nunca un finding
 * de otro run); `general` exige `nodeId`/`findingId` nulos.
 *
 * TOCTOU (carrera reproducida — verify check 15): toma `SELECT ... FOR UPDATE`
 * sobre la fila de proyecto (mismo recurso que bloquean `approveReview` paso 7,
 * `resolveReviewComment`, `openQaGate` e `insertPageVersion`) ANTES de validar,
 * y RELEE el `status` de la review bajo ese lock. Sin el lock, un
 * `addReviewComment(blocking=true)` podía colarse ENTRE el conteo de blockers
 * de `approveReview` (paso 7, ve 0) y su CAS (la review sigue `in_review`),
 * dejando `approved` + un comentario `blocking && open` — estado PROHIBIDO por
 * el GO. Con el lock la carrera tiene solo desenlaces legales: o el comentario
 * entra ANTES y `approveReview` lo cuenta en su paso 7 (falla por blockers), o
 * entra DESPUÉS del commit del approve y el guard `in_review` de abajo lo
 * rechaza. Se toma el lock SIEMPRE (no solo cuando `blocking=true`): comentar
 * es de baja frecuencia y serializar uniforme es más simple de razonar que un
 * lock condicional.
 */
export function addReviewComment(
  reviewId: string,
  ownerId: string,
  input: AddReviewCommentInput,
  actor: Actor
): Promise<PixelforgeReviewComment> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ review: pixelforgeReviews })
      .from(pixelforgeReviews)
      .innerJoin(pixelforgeProjects, eq(pixelforgeReviews.projectId, pixelforgeProjects.id))
      .where(and(eq(pixelforgeReviews.id, reviewId), eq(pixelforgeProjects.ownerId, ownerId)))
      .limit(1);
    if (!row) throw new Error("Revisión no encontrada");
    const review = row.review;

    // Lock de la fila de proyecto — MISMO recurso que bloquean approveReview
    // (paso 7, conteo de blockers), resolveReviewComment, openQaGate e
    // insertPageVersion. Se toma ANTES de validar/insertar para serializar
    // contra approveReview y cerrar el TOCTOU descrito en el docstring.
    await tx
      .select({ id: pixelforgeProjects.id })
      .from(pixelforgeProjects)
      .where(eq(pixelforgeProjects.id, review.projectId))
      .for("update")
      .limit(1);

    // Relectura del `status` DESPUÉS del lock — el `review` de arriba se leyó
    // FUERA del lock y puede estar rancio (un approve/supersede pudo commitear
    // entre esa lectura y la toma del lock). Este guard bajo lock es la
    // garantía dura: si approve ya ganó, la review ya no está `in_review` y el
    // comentario se rechaza en vez de aterrizar sobre una review aprobada.
    const [fresh] = await tx
      .select({ status: pixelforgeReviews.status })
      .from(pixelforgeReviews)
      .where(eq(pixelforgeReviews.id, reviewId))
      .limit(1);
    if (!fresh || fresh.status !== "in_review") {
      throw new Error("Solo se puede comentar en una revisión abierta");
    }
    if (!input.body || input.body.trim() === "") {
      throw new Error("El comentario no puede estar vacío");
    }

    if (input.anchorType === "general") {
      if (input.nodeId != null || input.findingId != null) {
        throw new Error("Un comentario general no puede llevar nodeId ni findingId");
      }
    } else if (input.anchorType === "section") {
      if (!input.nodeId) throw new Error("El comentario de sección requiere nodeId");
      const [pv] = await tx
        .select({ tree: pixelforgePageVersions.tree })
        .from(pixelforgePageVersions)
        .where(eq(pixelforgePageVersions.id, review.pageVersionId))
        .limit(1);
      if (!pv) throw new Error("Versión anclada no encontrada");
      if (!treeHasNode(pv.tree, input.nodeId)) {
        throw new Error(`El nodo "${input.nodeId}" no existe en la versión anclada`);
      }
    } else {
      if (!input.findingId) throw new Error("El comentario de finding requiere findingId");
      const [finding] = await tx
        .select({ id: pixelforgeQaFindings.id })
        .from(pixelforgeQaFindings)
        .where(
          and(
            eq(pixelforgeQaFindings.id, input.findingId),
            eq(pixelforgeQaFindings.qaRunId, review.qaRunId)
          )
        )
        .limit(1);
      if (!finding) {
        throw new Error(`El finding "${input.findingId}" no pertenece al QA anclado de esta revisión`);
      }
    }

    const [comment] = await tx
      .insert(pixelforgeReviewComments)
      .values({
        reviewId: review.id,
        projectId: review.projectId,
        anchorType: input.anchorType,
        nodeId: input.anchorType === "section" ? input.nodeId! : null,
        findingId: input.anchorType === "finding" ? input.findingId! : null,
        body: input.body,
        blocking: input.blocking,
        status: "open",
        authorId: actor.id,
        authorName: actor.name,
      })
      .returning();

    await tx.insert(pixelforgeEvents).values({
      projectId: review.projectId,
      station: "revision",
      type: "comment_added",
      actorId: actor.id,
      actorName: actor.name,
      snapshot: {
        commentId: comment.id,
        anchorType: input.anchorType,
        nodeId: comment.nodeId,
        findingId: comment.findingId,
        blocking: input.blocking,
      },
    });

    return comment;
  });
}

export interface ResolveReviewCommentInput {
  finalStatus: "resolved" | "dismissed";
  reason: string;
  evidence?: unknown;
}

/**
 * Resuelve (o descarta) un comentario. **CAS**: el UPDATE se condiciona a
 * `status='open'`; rowcount 0 → `ReviewConflictError` ("ya no está abierto").
 * Se permite resolver aunque la review ya NO esté `in_review` — los
 * bloqueantes viejos deben poder cerrarse en cualquier momento. `reason`
 * trim ≥5 se valida aquí (no solo en la route).
 *
 * Lock de proyecto: toma `SELECT ... FOR UPDATE` sobre la fila de proyecto
 * ANTES del CAS. El GO verbatim de PF-F9 lo exige explícitamente al "resolver
 * comentarios bloqueantes"; serializa con `approveReview` (que cuenta los
 * blockers `open` bajo el MISMO lock en su paso 7) y con `addReviewComment`, de
 * modo que "resolver un blocker" y "aprobar" no se pisen — approve nunca ve un
 * blocker a mitad de resolución.
 */
export function resolveReviewComment(
  commentId: string,
  ownerId: string,
  resolution: ResolveReviewCommentInput,
  actor: Actor
): Promise<void> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ projectId: pixelforgeReviewComments.projectId })
      .from(pixelforgeReviewComments)
      .innerJoin(pixelforgeProjects, eq(pixelforgeReviewComments.projectId, pixelforgeProjects.id))
      .where(and(eq(pixelforgeReviewComments.id, commentId), eq(pixelforgeProjects.ownerId, ownerId)))
      .limit(1);
    if (!row) throw new Error("Comentario no encontrado");

    // Lock de la fila de proyecto ANTES del CAS — el GO de PF-F9 lo exige al
    // resolver bloqueantes; serializa con approveReview (paso 7) y
    // addReviewComment sobre el mismo recurso (ver docstring).
    await tx
      .select({ id: pixelforgeProjects.id })
      .from(pixelforgeProjects)
      .where(eq(pixelforgeProjects.id, row.projectId))
      .for("update")
      .limit(1);

    if (resolution.reason.trim().length < 5) {
      throw new Error("La razón de resolución es demasiado corta (mínimo 5 caracteres)");
    }

    const now = new Date();
    const updated = await tx
      .update(pixelforgeReviewComments)
      .set({
        status: resolution.finalStatus,
        resolvedById: actor.id,
        resolvedByName: actor.name,
        resolvedAt: now,
        resolutionReason: resolution.reason,
        resolutionEvidence: resolution.evidence ?? null,
      })
      .where(and(eq(pixelforgeReviewComments.id, commentId), eq(pixelforgeReviewComments.status, "open")))
      .returning({ id: pixelforgeReviewComments.id });
    if (updated.length === 0) throw new ReviewConflictError("El comentario ya no está abierto");

    await tx.insert(pixelforgeEvents).values({
      projectId: row.projectId,
      station: "revision",
      type: "comment_resolved",
      actorId: actor.id,
      actorName: actor.name,
      reason: resolution.reason,
      snapshot: { commentId, finalStatus: resolution.finalStatus, resolutionReason: resolution.reason },
    });
  });
}

export interface RequestChangesInput {
  changeKind: ChangeKind;
  contentTarget?: "contexto" | "estrategia" | "blueprint";
  reason: string;
}

/**
 * Cierra la revisión pidiendo cambios (`changes_requested`) y ejecuta el
 * efecto correspondiente EN LA MISMA TX (lock de proyecto): reabrir un artifact
 * (cascada downstream vía `reopenArtifactInTx` — llamado en-tx para no
 * deadlockear con el lock, ver docstring de `reopenArtifact`), retroceder a
 * `produccion`, o bloqueo técnico sin cambio de estación. **CAS** sobre
 * `status='in_review'`. Si el artifact objetivo NO está sellado (p.ej. ya
 * reabierto) NO es error fatal: solo retrocede `current_station` a la estación
 * destino. Todo atómico: si cualquier paso lanza, nada queda escrito.
 */
export function requestChanges(
  reviewId: string,
  ownerId: string,
  input: RequestChangesInput,
  actor: Actor
): Promise<void> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ review: pixelforgeReviews })
      .from(pixelforgeReviews)
      .innerJoin(pixelforgeProjects, eq(pixelforgeReviews.projectId, pixelforgeProjects.id))
      .where(and(eq(pixelforgeReviews.id, reviewId), eq(pixelforgeProjects.ownerId, ownerId)))
      .limit(1);
    if (!row) throw new Error("Revisión no encontrada");
    const review = row.review;

    if (input.reason.trim().length < 5) {
      throw new Error("La razón del cambio es demasiado corta (mínimo 5 caracteres)");
    }

    // Lock del proyecto — serializa contra recompose/approve concurrente.
    await tx
      .select({ id: pixelforgeProjects.id })
      .from(pixelforgeProjects)
      .where(eq(pixelforgeProjects.id, review.projectId))
      .for("update")
      .limit(1);

    // Mapa cerrado server-side — lanza en input inválido (p.ej. 'contenido' sin contentTarget).
    const target = resolveChangeTarget(input.changeKind, input.contentTarget);

    const now = new Date();

    const openComments = await tx
      .select({ id: pixelforgeReviewComments.id })
      .from(pixelforgeReviewComments)
      .where(and(eq(pixelforgeReviewComments.reviewId, reviewId), eq(pixelforgeReviewComments.status, "open")));

    const updated = await tx
      .update(pixelforgeReviews)
      .set({
        status: "changes_requested",
        targetStation: target.station,
        requestReason: input.reason,
        closedAt: now,
        updatedAt: now,
      })
      .where(and(eq(pixelforgeReviews.id, reviewId), eq(pixelforgeReviews.status, "in_review")))
      .returning({ id: pixelforgeReviews.id });
    if (updated.length === 0) throw new ReviewConflictError("La revisión ya no está abierta");

    await tx.insert(pixelforgeEvents).values({
      projectId: review.projectId,
      station: "revision",
      type: "changes_requested",
      actorId: actor.id,
      actorName: actor.name,
      reason: input.reason,
      snapshot: {
        reviewId,
        targetStation: target.station,
        technicalBlock: target.mechanism === "technical_block",
        openComments: openComments.length,
      },
    });

    if (target.mechanism === "reopen_artifact") {
      const kind = target.artifactKind!;
      const [artifact] = await tx
        .select({ status: pixelforgeArtifacts.status })
        .from(pixelforgeArtifacts)
        .where(and(eq(pixelforgeArtifacts.projectId, review.projectId), eq(pixelforgeArtifacts.kind, kind)))
        .limit(1);
      if (!artifact) {
        // Anómalo (los 5 artifacts nacen con el proyecto): delega el throw a
        // reopenArtifactInTx ("Artifact no encontrado") — la tx entera revierte.
        await reopenArtifactInTx(tx, review.projectId, kind, `Cambios solicitados en revisión: ${input.reason}`, actor);
      } else if (artifact.status === "sealed") {
        await reopenArtifactInTx(tx, review.projectId, kind, `Cambios solicitados en revisión: ${input.reason}`, actor);
      } else {
        // No sellado (ya reabierto): no es fatal — solo retrocede la estación.
        await tx
          .update(pixelforgeProjects)
          .set({ currentStation: target.station!, updatedAt: now })
          .where(eq(pixelforgeProjects.id, review.projectId));
      }
    } else if (target.mechanism === "regress_station") {
      await tx
        .update(pixelforgeProjects)
        .set({ currentStation: "produccion", updatedAt: now })
        .where(
          and(
            eq(pixelforgeProjects.id, review.projectId),
            inArray(pixelforgeProjects.currentStation, ["revision", "qa"])
          )
        );
    }
    // technical_block: sin cambio de estación.

    await touchProject(tx, review.projectId);
  });
}

export interface ApproveReviewInput {
  reason: string;
  risks: Array<{ findingId: string; rationale: string }>;
}

/**
 * Aprueba una revisión — el camino más delicado. Lock de proyecto + validación
 * en ORDEN estricto (cada fallo = error distinto): ownership, review abierta,
 * versión vigente == anclada, qa_run anclado válido, el anclado es el ÚLTIMO
 * cerrado de esa versión Y abre la compuerta, hash de árbol coincide, cero
 * bloqueantes abiertos, riesgos aceptados válidos (construidos server-side y
 * ESCOPADOS al run anclado). **CAS** final sobre `status='in_review'`. Eventos
 * `risk_accepted` × entry + `approval_granted`.
 */
export function approveReview(
  reviewId: string,
  ownerId: string,
  input: ApproveReviewInput,
  actor: Actor
): Promise<void> {
  return db.transaction(async (tx) => {
    // 1. ownership.
    const [row] = await tx
      .select({ review: pixelforgeReviews })
      .from(pixelforgeReviews)
      .innerJoin(pixelforgeProjects, eq(pixelforgeReviews.projectId, pixelforgeProjects.id))
      .where(and(eq(pixelforgeReviews.id, reviewId), eq(pixelforgeProjects.ownerId, ownerId)))
      .limit(1);
    if (!row) throw new Error("Revisión no encontrada");
    const review = row.review;

    // Lock del proyecto — serializa contra recompose (supersede) y doble-approve.
    await tx
      .select({ id: pixelforgeProjects.id })
      .from(pixelforgeProjects)
      .where(eq(pixelforgeProjects.id, review.projectId))
      .for("update")
      .limit(1);

    if (input.reason.trim().length < 5) {
      throw new Error("La razón de aprobación es demasiado corta (mínimo 5 caracteres)");
    }

    // 2. review in_review (el CAS final es la garantía dura).
    if (review.status !== "in_review") throw new Error("La revisión no está abierta");

    // 3. versión vigente (releída bajo lock) === review.pageVersionId.
    const [vigente] = await tx
      .select({
        id: pixelforgePageVersions.id,
        version: pixelforgePageVersions.version,
        tree: pixelforgePageVersions.tree,
      })
      .from(pixelforgePageVersions)
      .where(eq(pixelforgePageVersions.projectId, review.projectId))
      .orderBy(desc(pixelforgePageVersions.version))
      .limit(1);
    if (!vigente || vigente.id !== review.pageVersionId) {
      throw new Error("La versión vigente cambió desde que se abrió la revisión; re-ancla o reabre la revisión");
    }

    // 4. qa_run anclado válido.
    const [run] = await tx
      .select()
      .from(pixelforgeQaRuns)
      .where(eq(pixelforgeQaRuns.id, review.qaRunId))
      .limit(1);
    if (!run || run.pageVersionId !== review.pageVersionId || run.status !== "succeeded" || run.verdict === null) {
      throw new Error("El QA anclado ya no es válido para aprobar esta revisión");
    }

    // 5. el anclado es el ÚLTIMO cerrado de esa versión Y abre la compuerta.
    const runsForVersion = await tx
      .select({
        id: pixelforgeQaRuns.id,
        verdict: pixelforgeQaRuns.verdict,
        humanDecision: pixelforgeQaRuns.humanDecision,
        status: pixelforgeQaRuns.status,
      })
      .from(pixelforgeQaRuns)
      .where(eq(pixelforgeQaRuns.pageVersionId, review.pageVersionId))
      .orderBy(desc(pixelforgeQaRuns.createdAt));
    const latestClosed = runsForVersion.find((r) => r.status === "succeeded" && r.verdict !== null);
    if (!latestClosed || latestClosed.id !== run.id) {
      throw new Error("Hay un QA más reciente sobre esta versión; re-ancla la revisión al QA vigente");
    }
    if (!wouldRunOpenGate({ verdict: run.verdict, humanDecision: run.humanDecision })) {
      throw new Error("El QA anclado no abre la compuerta; re-ejecuta QA o solicita cambios");
    }

    // 6. hash del árbol (releído en la tx).
    if (!treeHashMatches(vigente.tree, review.treeHash)) {
      throw new Error("El contenido de la versión cambió desde que se abrió la revisión (hash no coincide)");
    }

    // 7. cero comentarios bloqueantes abiertos del proyecto (bajo tx).
    const blockingOpen = await tx
      .select({ id: pixelforgeReviewComments.id })
      .from(pixelforgeReviewComments)
      .where(
        and(
          eq(pixelforgeReviewComments.projectId, review.projectId),
          eq(pixelforgeReviewComments.blocking, true),
          eq(pixelforgeReviewComments.status, "open")
        )
      );
    if (blockingOpen.length > 0) {
      throw new Error(
        `No se puede aprobar: quedan ${blockingOpen.length} comentario(s) bloqueante(s) sin resolver`
      );
    }

    // 8. AcceptedRiskEntry[] server-side, ESCOPADOS al run anclado.
    const findings = await tx
      .select()
      .from(pixelforgeQaFindings)
      .where(eq(pixelforgeQaFindings.qaRunId, run.id));
    const findingsById = new Map(findings.map((f) => [f.id, f]));
    const nowIso = new Date().toISOString();
    const entries: AcceptedRiskEntry[] = [];
    for (const risk of input.risks) {
      const f = findingsById.get(risk.findingId);
      if (!f) throw new Error(`El finding "${risk.findingId}" no existe en el QA anclado`);
      entries.push({
        findingId: f.id,
        qaRunId: run.id,
        checkCode: f.checkCode,
        severity: f.severity,
        rationale: risk.rationale,
        acceptedById: actor.id,
        acceptedByName: actor.name,
        acceptedAt: nowIso,
      });
    }
    const findingLikes: FindingLike[] = findings.map((f) => ({
      id: f.id,
      checkCode: f.checkCode,
      severity: f.severity,
      blocking: f.blocking,
    }));
    const validation = validateAcceptedRisks({
      verdict: run.verdict,
      anchoredQaRunId: run.id,
      findings: findingLikes,
      entries,
    });
    if (!validation.ok) throw new Error(validation.error);

    // 9. CAS.
    const now = new Date();
    const updated = await tx
      .update(pixelforgeReviews)
      .set({
        status: "approved",
        acceptedRisks: entries,
        approvedById: actor.id,
        approvedByName: actor.name,
        approvedAt: now,
        approvalReason: input.reason,
        closedAt: now,
        updatedAt: now,
      })
      .where(and(eq(pixelforgeReviews.id, reviewId), eq(pixelforgeReviews.status, "in_review")))
      .returning({ id: pixelforgeReviews.id });
    if (updated.length === 0) throw new ReviewConflictError("La revisión ya no está abierta");

    // 10. eventos: risk_accepted × entry, luego approval_granted.
    for (const entry of entries) {
      await tx.insert(pixelforgeEvents).values({
        projectId: review.projectId,
        station: "revision",
        type: "risk_accepted",
        actorId: actor.id,
        actorName: actor.name,
        snapshot: entry,
      });
    }
    await tx.insert(pixelforgeEvents).values({
      projectId: review.projectId,
      station: "revision",
      type: "approval_granted",
      actorId: actor.id,
      actorName: actor.name,
      reason: input.reason,
      snapshot: {
        reviewId,
        pageVersionId: review.pageVersionId,
        version: vigente.version,
        qaRunId: run.id,
        treeHash: review.treeHash,
        acceptedRisksCount: entries.length,
      },
    });

    await touchProject(tx, review.projectId);
  });
}

/**
 * Cancela una revisión abierta (sin lock de proyecto — no toca estaciones).
 * **CAS** sobre `status='in_review'`. Los comentarios conservan su status
 * propio. `reason` trim ≥5.
 */
export function cancelReview(
  reviewId: string,
  ownerId: string,
  reason: string,
  actor: Actor
): Promise<void> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ review: pixelforgeReviews })
      .from(pixelforgeReviews)
      .innerJoin(pixelforgeProjects, eq(pixelforgeReviews.projectId, pixelforgeProjects.id))
      .where(and(eq(pixelforgeReviews.id, reviewId), eq(pixelforgeProjects.ownerId, ownerId)))
      .limit(1);
    if (!row) throw new Error("Revisión no encontrada");
    const review = row.review;

    if (reason.trim().length < 5) {
      throw new Error("La razón de cancelación es demasiado corta (mínimo 5 caracteres)");
    }

    const now = new Date();
    const updated = await tx
      .update(pixelforgeReviews)
      .set({ status: "cancelled", requestReason: reason, closedAt: now, updatedAt: now })
      .where(and(eq(pixelforgeReviews.id, reviewId), eq(pixelforgeReviews.status, "in_review")))
      .returning({ id: pixelforgeReviews.id });
    if (updated.length === 0) throw new ReviewConflictError("La revisión ya no está abierta");

    await tx.insert(pixelforgeEvents).values({
      projectId: review.projectId,
      station: "revision",
      type: "review_cancelled",
      actorId: actor.id,
      actorName: actor.name,
      reason,
      snapshot: { reviewId, roundNumber: review.roundNumber },
    });
  });
}

/**
 * Re-ancla una revisión abierta al QA cerrado más reciente de SU misma versión
 * (para cuando un re-QA sobre la vigente cerró después de abrir la revisión).
 * Lock de proyecto; exige que el nuevo run difiera del anclado y que abra la
 * compuerta (`wouldRunOpenGate`) — un re-QA con fail NO se puede anclar.
 * **CAS** sobre `status='in_review'`; actualiza qaRunId + snapshots.
 */
export function reanchorReview(reviewId: string, ownerId: string, actor: Actor): Promise<void> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ review: pixelforgeReviews })
      .from(pixelforgeReviews)
      .innerJoin(pixelforgeProjects, eq(pixelforgeReviews.projectId, pixelforgeProjects.id))
      .where(and(eq(pixelforgeReviews.id, reviewId), eq(pixelforgeProjects.ownerId, ownerId)))
      .limit(1);
    if (!row) throw new Error("Revisión no encontrada");
    const review = row.review;

    await tx
      .select({ id: pixelforgeProjects.id })
      .from(pixelforgeProjects)
      .where(eq(pixelforgeProjects.id, review.projectId))
      .for("update")
      .limit(1);

    if (review.status !== "in_review") throw new Error("La revisión no está abierta");

    const runsForVersion = await tx
      .select()
      .from(pixelforgeQaRuns)
      .where(eq(pixelforgeQaRuns.pageVersionId, review.pageVersionId))
      .orderBy(desc(pixelforgeQaRuns.createdAt));
    const latestClosed = runsForVersion.find((r) => r.status === "succeeded" && r.verdict !== null);
    if (!latestClosed) throw new Error("No hay un QA cerrado sobre la versión de esta revisión");
    if (latestClosed.id === review.qaRunId) {
      throw new Error("La revisión ya está anclada al QA más reciente de su versión");
    }
    if (!wouldRunOpenGate({ verdict: latestClosed.verdict, humanDecision: latestClosed.humanDecision })) {
      throw new Error("El QA más reciente no abre la compuerta; re-ejecuta QA o solicita cambios");
    }
    if (latestClosed.verdict === null || latestClosed.scoreTotal === null) {
      throw new Error("El QA más reciente no tiene veredicto resuelto");
    }

    const now = new Date();
    const updated = await tx
      .update(pixelforgeReviews)
      .set({
        qaRunId: latestClosed.id,
        verdictSnapshot: latestClosed.verdict,
        scoreSnapshot: latestClosed.scoreTotal,
        updatedAt: now,
      })
      .where(and(eq(pixelforgeReviews.id, reviewId), eq(pixelforgeReviews.status, "in_review")))
      .returning({ id: pixelforgeReviews.id });
    if (updated.length === 0) throw new ReviewConflictError("La revisión ya no está abierta");

    await tx.insert(pixelforgeEvents).values({
      projectId: review.projectId,
      station: "revision",
      type: "review_opened",
      actorId: actor.id,
      actorName: actor.name,
      snapshot: {
        reviewId,
        reanchored: true,
        qaRunId: latestClosed.id,
        verdict: latestClosed.verdict,
        scoreTotal: latestClosed.scoreTotal,
        roundNumber: review.roundNumber,
      },
    });
  });
}

/**
 * INTERNA — supersede cualquier revisión NO terminal-benigna del proyecto
 * (`in_review`/`approved`/`changes_requested`) cuando una versión nueva
 * aterriza. La invoca `insertPageVersion` DENTRO de su tx (bajo el lock de
 * proyecto que ya tomó). NO toca estaciones upstream, NO borra nada. Emite
 * `approval_superseded` si la review estaba `approved`, si no
 * `review_superseded`. Se seleccionan las filas ANTES del UPDATE para capturar
 * su status previo (el `.returning()` de un UPDATE devuelve el status NUEVO,
 * inútil para discriminar el evento).
 */
async function supersedeActiveReviewsInTx(
  tx: Tx,
  projectId: string,
  newPageVersionId: string,
  newVersion: number,
  actorName: string
): Promise<void> {
  const active = await tx
    .select({ id: pixelforgeReviews.id, status: pixelforgeReviews.status })
    .from(pixelforgeReviews)
    .where(
      and(
        eq(pixelforgeReviews.projectId, projectId),
        inArray(pixelforgeReviews.status, ["in_review", "approved", "changes_requested"])
      )
    );
  if (active.length === 0) return;

  const now = new Date();
  await tx
    .update(pixelforgeReviews)
    .set({ status: "superseded", closedAt: now, updatedAt: now })
    .where(inArray(pixelforgeReviews.id, active.map((r) => r.id)));

  for (const review of active) {
    await tx.insert(pixelforgeEvents).values({
      projectId,
      station: "revision",
      type: review.status === "approved" ? "approval_superseded" : "review_superseded",
      actorId: null,
      actorName,
      snapshot: {
        reviewId: review.id,
        previousStatus: review.status,
        newPageVersionId,
        newVersion,
      },
    });
  }
}

// ─── Helpers privados ──────────────────────────────────────────────────────

async function touchProject(tx: Tx, projectId: string) {
  await tx
    .update(pixelforgeProjects)
    .set({ updatedAt: new Date() })
    .where(eq(pixelforgeProjects.id, projectId));
}
