/**
 * Repo de "Definición de Proyecto" — pipeline IA por estaciones (PM retador).
 *
 * Todo el CRUD va escopado por `ownerId` (patrón de crm.ts). La lógica de
 * sellado/reapertura vive aquí porque es puramente de estados relacionales:
 * sellar avanza `currentStation`; reabrir una estación invalida los sellos
 * downstream. Cada transición deja un `definition_events` con snapshot para
 * auditoría (lo sellado no se pierde: queda congelado en el evento).
 *
 * Ver src/lib/definition/types.ts para el orden canónico de estaciones.
 */
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  clients,
  projectDefinitions,
  definitionStations,
  definitionMessages,
  definitionEvents,
  type DefinitionMessage,
  type DefinitionStationRow,
  type ProjectDefinition,
} from "@/lib/db/schema";
import {
  STATION_SEQUENCE,
  isDownstream,
  nextStation,
  type DefinitionStation,
} from "@/lib/definition/types";

export interface Actor {
  id: string;
  name: string;
}

// ─── Lectura ───────────────────────────────────────────────────────────────

export interface DefinitionFull {
  definition: ProjectDefinition;
  stations: DefinitionStationRow[];
  messages: DefinitionMessage[];
  events: (typeof definitionEvents.$inferSelect)[];
}

/** Definición + estaciones + mensajes + eventos, escopada por owner. Null si no existe. */
export async function getDefinitionFull(
  definitionId: string,
  ownerId: string
): Promise<DefinitionFull | null> {
  const definition = await db
    .select()
    .from(projectDefinitions)
    .where(
      and(
        eq(projectDefinitions.id, definitionId),
        eq(projectDefinitions.ownerId, ownerId)
      )
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!definition) return null;

  const [stations, messages, events] = await Promise.all([
    db
      .select()
      .from(definitionStations)
      .where(eq(definitionStations.definitionId, definitionId)),
    db
      .select()
      .from(definitionMessages)
      .where(eq(definitionMessages.definitionId, definitionId))
      .orderBy(asc(definitionMessages.createdAt)),
    db
      .select()
      .from(definitionEvents)
      .where(eq(definitionEvents.definitionId, definitionId))
      .orderBy(desc(definitionEvents.createdAt)),
  ]);

  // Orden estable de estaciones según la secuencia canónica.
  stations.sort(
    (a, b) =>
      STATION_SEQUENCE.indexOf(a.station) - STATION_SEQUENCE.indexOf(b.station)
  );

  return { definition, stations, messages, events };
}

/** Solo la fila de definición (para chequeos de gating), escopada por owner. */
export function getDefinition(definitionId: string, ownerId: string) {
  return db
    .select()
    .from(projectDefinitions)
    .where(
      and(
        eq(projectDefinitions.id, definitionId),
        eq(projectDefinitions.ownerId, ownerId)
      )
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export interface DefinitionListItem {
  id: string;
  title: string;
  clientId: string;
  clientName: string | null;
  currentStation: DefinitionStation;
  status: ProjectDefinition["status"];
  proposalId: string | null;
  updatedAt: Date;
  createdAt: Date;
}

/** Lista de definiciones del owner con el nombre del cliente (join). */
export function listDefinitionsByOwner(
  ownerId: string
): Promise<DefinitionListItem[]> {
  return db
    .select({
      id: projectDefinitions.id,
      title: projectDefinitions.title,
      clientId: projectDefinitions.clientId,
      clientName: clients.name,
      currentStation: projectDefinitions.currentStation,
      status: projectDefinitions.status,
      proposalId: projectDefinitions.proposalId,
      updatedAt: projectDefinitions.updatedAt,
      createdAt: projectDefinitions.createdAt,
    })
    .from(projectDefinitions)
    .leftJoin(clients, eq(projectDefinitions.clientId, clients.id))
    .where(eq(projectDefinitions.ownerId, ownerId))
    .orderBy(desc(projectDefinitions.updatedAt));
}

/** Mensajes de una estación en orden cronológico (para armar el prompt). */
export function getStationMessages(
  definitionId: string,
  station: DefinitionStation
): Promise<DefinitionMessage[]> {
  return db
    .select()
    .from(definitionMessages)
    .where(
      and(
        eq(definitionMessages.definitionId, definitionId),
        eq(definitionMessages.station, station)
      )
    )
    .orderBy(asc(definitionMessages.createdAt));
}

// ─── Escritura ───────────────────────────────────────────────────────────

export interface CreateDefinitionInput {
  ownerId: string;
  clientId: string;
  clientCrmId: string;
  title: string;
  brainDump: string;
  actor: Actor;
  /** false => se crea como `draft`, sin arrancar la estación `boceto`. */
  start: boolean;
}

/**
 * Crea la definición + las 4 filas de estación + el evento `created`, en una
 * transacción. Si `start` es true, arranca de una vez (status `in_progress`,
 * `boceto` en `in_progress`) — igual que el flujo original. Si es false,
 * queda en `draft` con las 4 estaciones en `pending` hasta que se llame a
 * `startDefinition`. Devuelve el id.
 */
export function createDefinition(input: CreateDefinitionInput): Promise<string> {
  return db.transaction(async (tx) => {
    const [def] = await tx
      .insert(projectDefinitions)
      .values({
        ownerId: input.ownerId,
        clientId: input.clientId,
        clientCrmId: input.clientCrmId,
        title: input.title,
        brainDump: input.brainDump,
        currentStation: "boceto",
        status: input.start ? "in_progress" : "draft",
      })
      .returning({ id: projectDefinitions.id });

    await tx.insert(definitionStations).values(
      STATION_SEQUENCE.map((station) => ({
        definitionId: def.id,
        station,
        status:
          input.start && station === "boceto" ? ("in_progress" as const) : ("pending" as const),
      }))
    );

    await tx.insert(definitionEvents).values({
      definitionId: def.id,
      station: null,
      type: "created",
      actorId: input.actor.id,
      actorName: input.actor.name,
    });

    return def.id;
  });
}

/**
 * Arranca una definición en `draft`: pasa a `in_progress` y activa la
 * estación `boceto`. Deja evento `started`. Lanza si no está en `draft`.
 */
export function startDefinition(definitionId: string, ownerId: string, actor: Actor) {
  return db.transaction(async (tx) => {
    const [def] = await tx
      .select()
      .from(projectDefinitions)
      .where(
        and(eq(projectDefinitions.id, definitionId), eq(projectDefinitions.ownerId, ownerId))
      )
      .limit(1);
    if (!def) throw new Error("Definición no encontrada");
    if (def.status !== "draft") throw new Error("La definición ya fue iniciada");

    const now = new Date();
    await tx
      .update(projectDefinitions)
      .set({ status: "in_progress", updatedAt: now })
      .where(eq(projectDefinitions.id, definitionId));

    await tx
      .update(definitionStations)
      .set({ status: "in_progress", updatedAt: now })
      .where(
        and(eq(definitionStations.definitionId, definitionId), eq(definitionStations.station, "boceto"))
      );

    await tx.insert(definitionEvents).values({
      definitionId,
      station: null,
      type: "started",
      actorId: actor.id,
      actorName: actor.name,
    });
  });
}

/**
 * Edita nombre/descarga mental de una definición mientras siga en `draft`.
 * Lanza si ya fue iniciada (la descarga mental es inmutable en ese punto).
 */
export async function updateDraft(
  definitionId: string,
  ownerId: string,
  fields: { title: string; brainDump: string }
) {
  const [def] = await db
    .select({ status: projectDefinitions.status })
    .from(projectDefinitions)
    .where(and(eq(projectDefinitions.id, definitionId), eq(projectDefinitions.ownerId, ownerId)))
    .limit(1);
  if (!def) throw new Error("Definición no encontrada");
  if (def.status !== "draft") throw new Error("Solo se puede editar un borrador");

  await db
    .update(projectDefinitions)
    .set({ title: fields.title, brainDump: fields.brainDump, updatedAt: new Date() })
    .where(eq(projectDefinitions.id, definitionId));
}

export function appendMessage(
  definitionId: string,
  station: DefinitionStation,
  role: "user" | "assistant",
  content: string
) {
  return db
    .insert(definitionMessages)
    .values({ definitionId, station, role, content })
    .returning()
    .then((rows) => rows[0]);
}

/** Guarda el último borrador de la IA en la fila de estación. */
export async function updateStationDraft(
  definitionId: string,
  station: DefinitionStation,
  draft: string
) {
  await db
    .update(definitionStations)
    .set({ currentDraft: draft, updatedAt: new Date() })
    .where(
      and(
        eq(definitionStations.definitionId, definitionId),
        eq(definitionStations.station, station)
      )
    );
  await touchDefinition(definitionId);
}

/**
 * Sella la estación activa: congela `currentDraft` en `sealedContent` con
 * fecha/autor, deja evento `sealed`, y avanza `currentStation` a la siguiente
 * (que pasa de `pending`/`invalidated` a `in_progress`) o marca la definición
 * como `completed` si era la última. Transacción.
 *
 * Lanza si la estación no es la activa o si no hay borrador que sellar.
 */
export function sealStation(
  definitionId: string,
  station: DefinitionStation,
  actor: Actor
) {
  return db.transaction(async (tx) => {
    const [def] = await tx
      .select()
      .from(projectDefinitions)
      .where(eq(projectDefinitions.id, definitionId))
      .limit(1);
    if (!def) throw new Error("Definición no encontrada");
    if (def.currentStation !== station) {
      throw new Error("Solo se puede sellar la estación activa");
    }

    const [row] = await tx
      .select()
      .from(definitionStations)
      .where(
        and(
          eq(definitionStations.definitionId, definitionId),
          eq(definitionStations.station, station)
        )
      )
      .limit(1);
    if (!row) throw new Error("Estación no encontrada");
    if (!row.currentDraft || row.currentDraft.trim() === "") {
      throw new Error("No hay borrador para sellar");
    }

    const now = new Date();
    await tx
      .update(definitionStations)
      .set({
        status: "sealed",
        sealedContent: row.currentDraft,
        sealedAt: now,
        sealedBy: actor.id,
        sealedByName: actor.name,
        updatedAt: now,
      })
      .where(eq(definitionStations.id, row.id));

    await tx.insert(definitionEvents).values({
      definitionId,
      station,
      type: "sealed",
      actorId: actor.id,
      actorName: actor.name,
    });

    const next = nextStation(station);
    if (next) {
      await tx
        .update(definitionStations)
        .set({ status: "in_progress", updatedAt: now })
        .where(
          and(
            eq(definitionStations.definitionId, definitionId),
            eq(definitionStations.station, next)
          )
        );
      await tx
        .update(projectDefinitions)
        .set({ currentStation: next, updatedAt: now })
        .where(eq(projectDefinitions.id, definitionId));
    } else {
      await tx
        .update(projectDefinitions)
        .set({ status: "completed", updatedAt: now })
        .where(eq(projectDefinitions.id, definitionId));
    }
  });
}

/**
 * Reabre una estación sellada: guarda el sello viejo como snapshot (evento
 * `reopened`), la vuelve `in_progress` retomando desde lo sellado, e invalida
 * el sello de TODA estación downstream (evento `invalidated` + snapshot). Los
 * borradores e historiales downstream se conservan. `currentStation` vuelve a
 * la reabierta; si estaba `completed`, vuelve a `in_progress`. Transacción.
 *
 * No revierte una conversión previa a proyecto CRM (el proyecto ya existe);
 * la UI avisa que los documentos cambiaron después de convertir.
 */
export function reopenStation(
  definitionId: string,
  station: DefinitionStation,
  reason: string,
  actor: Actor
) {
  return db.transaction(async (tx) => {
    const [def] = await tx
      .select()
      .from(projectDefinitions)
      .where(eq(projectDefinitions.id, definitionId))
      .limit(1);
    if (!def) throw new Error("Definición no encontrada");

    const rows = await tx
      .select()
      .from(definitionStations)
      .where(eq(definitionStations.definitionId, definitionId));

    const target = rows.find((r) => r.station === station);
    if (!target) throw new Error("Estación no encontrada");
    if (target.status !== "sealed") {
      throw new Error("Solo se puede reabrir una estación sellada");
    }

    const now = new Date();

    // Estación reabierta: rastro + retomar desde lo sellado.
    await tx.insert(definitionEvents).values({
      definitionId,
      station,
      type: "reopened",
      actorId: actor.id,
      actorName: actor.name,
      reason,
      snapshot: target.sealedContent,
    });
    await tx
      .update(definitionStations)
      .set({
        status: "in_progress",
        currentDraft: target.sealedContent,
        sealedContent: null,
        sealedAt: null,
        sealedBy: null,
        sealedByName: null,
        reopenCount: target.reopenCount + 1,
        updatedAt: now,
      })
      .where(eq(definitionStations.id, target.id));

    // Downstream: invalidar sellos y trabajo en progreso.
    for (const r of rows) {
      if (!isDownstream(station, r.station)) continue;
      if (r.status === "sealed") {
        await tx.insert(definitionEvents).values({
          definitionId,
          station: r.station,
          type: "invalidated",
          actorId: actor.id,
          actorName: actor.name,
          reason,
          snapshot: r.sealedContent,
        });
      }
      if (r.status === "sealed" || r.status === "in_progress") {
        await tx
          .update(definitionStations)
          .set({
            status: "invalidated",
            sealedContent: null,
            sealedAt: null,
            sealedBy: null,
            sealedByName: null,
            updatedAt: now,
          })
          .where(eq(definitionStations.id, r.id));
      }
    }

    await tx
      .update(projectDefinitions)
      .set({
        currentStation: station,
        status: "in_progress",
        updatedAt: now,
      })
      .where(eq(projectDefinitions.id, definitionId));
  });
}

/** Registra la propuesta generada a partir de la definición sellada. */
export function attachProposal(
  definitionId: string,
  ownerId: string,
  proposalId: string,
  actor: Actor
) {
  return db.transaction(async (tx) => {
    const now = new Date();
    const updated = await tx
      .update(projectDefinitions)
      .set({ proposalId, updatedAt: now })
      .where(
        and(
          eq(projectDefinitions.id, definitionId),
          eq(projectDefinitions.ownerId, ownerId)
        )
      )
      .returning({ id: projectDefinitions.id });
    if (updated.length === 0) throw new Error("Definición no encontrada");

    await tx.insert(definitionEvents).values({
      definitionId,
      station: null,
      type: "converted",
      actorId: actor.id,
      actorName: actor.name,
      reason: proposalId,
    });
  });
}

async function touchDefinition(definitionId: string) {
  await db
    .update(projectDefinitions)
    .set({ updatedAt: new Date() })
    .where(eq(projectDefinitions.id, definitionId));
}
