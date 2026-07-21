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
  });
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
export async function finalizeQaRun(
  qaRunId: string,
  result: FinalizeQaRunInput
): Promise<boolean> {
  const now = new Date();
  const [run] = await db
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

  await db.insert(pixelforgeEvents).values({
    projectId: run.projectId,
    station: "qa",
    type: "qa_finished",
    actorId: run.requestedById,
    actorName: run.requestedByName,
    reason: result.verdict,
    snapshot: { verdict: result.verdict, scoreTotal: result.scoreTotal },
  });

  return true;
}

/**
 * Cierra una corrida de QA con falla: UPDATE condicional
 * `WHERE id=... AND status IN ('queued','running')` → `status='failed'` —
 * mismo patrón idempotente que `finalizeQaRun` (2 filas del estado inicial
 * porque un run puede fallar ANTES de llegar a `running`, p. ej. un error de
 * setup mientras seguía `queued`). Devuelve `true` si ESTA llamada cerró el
 * run.
 */
export async function failQaRun(
  qaRunId: string,
  failureKind: string,
  error: string
): Promise<boolean> {
  const now = new Date();
  const [run] = await db
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

  await db.insert(pixelforgeEvents).values({
    projectId: run.projectId,
    station: "qa",
    type: "qa_failed",
    actorId: run.requestedById,
    actorName: run.requestedByName,
    reason: failureKind,
    snapshot: null,
  });

  return true;
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

export type QaRunStaleReason = "queued_timeout" | "browser_claim_timeout" | "running_timeout";

/** Umbrales de staleness (ms) — ver docstring de `isStaleQaRun`. */
export const QA_QUEUED_TIMEOUT_MS = 10 * 60 * 1000;
export const QA_BROWSER_CLAIM_TIMEOUT_MS = 10 * 60 * 1000;
export const QA_RUNNING_TIMEOUT_MS = 20 * 60 * 1000;

export interface QaRunStalenessInput {
  status: PixelforgeQaRun["status"];
  browserStatus: PixelforgeQaRun["browserStatus"];
  createdAt: Date;
  browserClaimedAt: Date | null;
}

/**
 * Función PURA (testeable sin DB, mismo patrón que
 * `computeNextPageVersion`/`assertDirectionDecisionStillCurrent`): decide si
 * un run de QA quedó "atorado" y debe marcarse como fallido. 3 condiciones,
 * en orden de chequeo (la primera que aplica gana):
 *   1. `queued` hace más de 10 min (`createdAt`) — nunca lo reclamó nadie.
 *   2. `browser_status='running'` con `browserClaimedAt` de hace más de
 *      10 min — el qa-runner externo se colgó o murió sin reportar.
 *   3. `status='running'` hace más de 20 min (`createdAt`) — el run completo
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
    }

    const closed = await failQaRun(run.id, "timeout", `QA marcado como fallido por inactividad (${reason})`);
    if (closed) swept += 1;
  }

  return swept;
}

// ─── Helpers privados ──────────────────────────────────────────────────────

async function touchProject(tx: Tx, projectId: string) {
  await tx
    .update(pixelforgeProjects)
    .set({ updatedAt: new Date() })
    .where(eq(pixelforgeProjects.id, projectId));
}
