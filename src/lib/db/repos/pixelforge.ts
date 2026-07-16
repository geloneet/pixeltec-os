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
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  clients,
  pixelforgeProjects,
  pixelforgeContextSources,
  pixelforgeArtifacts,
  pixelforgeEvents,
  pixelforgeAiRuns,
  type PixelforgeProject,
  type PixelforgeContextSource,
  type PixelforgeArtifact,
  type PixelforgeEvent,
  type PixelforgeAiRun,
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
}

/** Proyecto + artifacts + fuentes + eventos, escopado por owner. Null si no existe. */
export async function getPixelforgeProjectFull(
  projectId: string,
  ownerId: string
): Promise<PixelforgeProjectFull | null> {
  const project = await getPixelforgeProject(projectId, ownerId);
  if (!project) return null;

  const [artifacts, sources, events] = await Promise.all([
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
  ]);

  // Orden estable de artifacts según la secuencia canónica de kinds.
  artifacts.sort(
    (a, b) => ARTIFACT_KINDS.indexOf(a.kind) - ARTIFACT_KINDS.indexOf(b.kind)
  );

  return { project, artifacts, sources, events };
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
 * estaba `pending` pasa a `in_progress` (primera edición). Actualiza
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
        status: artifact.status === "pending" ? "in_progress" : artifact.status,
        ...(opts?.lastRunId ? { lastRunId: opts.lastRunId } : {}),
        updatedAt: now,
      })
      .where(eq(pixelforgeArtifacts.id, artifact.id));

    await touchProject(tx, projectId);
  });
}

/**
 * Sella el artifact activo: congela `currentDraft` en `sealedContent` con
 * fecha/autor, deja evento `sealed`, y si la estación activa del proyecto ES
 * la que sella este kind, avanza `currentStation` a la siguiente. Si
 * `nextStation` fuera null (rama defensiva: no alcanzable con los 5 kinds de
 * F2, que solo llegan hasta `blueprint` — cuyo `nextStation` es `produccion`,
 * no null) el status del proyecto NO cambia acá; producción/QA/revisión
 * (fases futuras) decidirán ahí cuándo completar el proyecto. Transacción.
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

// ─── Helpers privados ──────────────────────────────────────────────────────

async function touchProject(tx: Tx, projectId: string) {
  await tx
    .update(pixelforgeProjects)
    .set({ updatedAt: new Date() })
    .where(eq(pixelforgeProjects.id, projectId));
}
