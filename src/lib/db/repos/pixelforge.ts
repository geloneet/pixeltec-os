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
  type PixelforgeProject,
  type PixelforgeContextSource,
  type PixelforgeArtifact,
  type PixelforgeEvent,
} from "@/lib/db/schema";
import {
  ARTIFACT_KINDS,
  type PixelforgeStation,
  type PixelforgeSourceType,
} from "@/lib/pixelforge/types";

export interface Actor {
  id: string;
  name: string;
}

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

// ─── Helpers privados ──────────────────────────────────────────────────────

async function touchProject(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  projectId: string
) {
  await tx
    .update(pixelforgeProjects)
    .set({ updatedAt: new Date() })
    .where(eq(pixelforgeProjects.id, projectId));
}
