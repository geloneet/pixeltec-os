'use server';

// Fase 4 (rebanada Documentos): Postgres — antes Firestore `strategies` vía
// client SDK.
import { and, eq, isNull } from "drizzle-orm";
import postgres from "postgres";
import { db } from "@/lib/db";
import { strategies } from "@/lib/db/schema";
import type { Strategy } from "@/types/documents";
import {
  requireOwner,
  resolveOwnedClientPgId,
  resolveOwnedProjectForClientPgId,
  resolveClientPgId,
  resolveProjectPgId,
  resolveStrategyRow,
  serializeStrategy,
} from "./pg";

// A lo sumo una estrategia por (owner, cliente, proyecto) y a lo sumo una
// huérfana por (owner, cliente) — garantizado en DB (drizzle/0038), no solo
// en la capa de repo. Mismo patrón que `pixelforge_qa_runs_active_idx`
// (src/lib/db/repos/pixelforge.ts): createStrategy traduce el 23505 a
// "reutilizar la fila existente" en vez de dejarlo subir crudo.
const STRATEGY_SCOPED_CONSTRAINT = "strategies_owner_client_project_uidx";
const STRATEGY_ORPHAN_CONSTRAINT = "strategies_owner_client_orphan_uidx";

function isStrategyUniqueViolation(err: unknown): boolean {
  const cause = err instanceof Error ? err.cause : undefined;
  return (
    cause instanceof postgres.PostgresError &&
    cause.code === "23505" &&
    (cause.constraint_name === STRATEGY_SCOPED_CONSTRAINT ||
      cause.constraint_name === STRATEGY_ORPHAN_CONSTRAINT)
  );
}

/**
 * ADR-0035: la estrategia pertenece a un PROYECTO. Con `projectId` se busca
 * primero la del proyecto; si no existe, cae a la huérfana del cliente
 * (project_id NULL, la estrategia histórica pre-migración) para no perderla.
 */
export async function getStrategy(_uid: string, clientId: string, projectId?: string): Promise<Strategy | null> {
  const { uid, ownerId } = await requireOwner();
  const clientPgId = await resolveClientPgId(clientId);
  if (!clientPgId) return null;

  if (projectId) {
    const projectPgId = await resolveProjectPgId(projectId);
    if (!projectPgId) return null;
    const [own] = await db
      .select()
      .from(strategies)
      .where(and(eq(strategies.ownerId, ownerId), eq(strategies.clientId, clientPgId), eq(strategies.projectId, projectPgId)))
      .limit(1);
    if (own) return serializeStrategy(own, clientId, uid, projectId);
    const [orphan] = await db
      .select()
      .from(strategies)
      .where(and(eq(strategies.ownerId, ownerId), eq(strategies.clientId, clientPgId), isNull(strategies.projectId)))
      .limit(1);
    return orphan ? serializeStrategy(orphan, clientId, uid, null) : null;
  }

  const [row] = await db
    .select()
    .from(strategies)
    .where(and(eq(strategies.ownerId, ownerId), eq(strategies.clientId, clientPgId)))
    .limit(1);
  return row ? serializeStrategy(row, clientId, uid, null) : null;
}

export async function createStrategy(_uid: string, clientId: string, projectId?: string): Promise<string> {
  const { ownerId } = await requireOwner();
  const clientPgId = await resolveOwnedClientPgId(clientId, ownerId);
  if (!clientPgId) throw new Error("Cliente no encontrado");
  // Un projectId ajeno —o de OTRO cliente del mismo owner— debe fallar, no
  // degradar a `null` ni enlazar mal: resolveOwnedProjectForClientPgId exige
  // que el proyecto sea de ESTE clientPgId, no solo de este owner.
  const projectPgId = projectId ? await resolveOwnedProjectForClientPgId(projectId, clientPgId, ownerId) : null;
  if (projectId && !projectPgId) throw new Error("Proyecto no encontrado");

  try {
    const [row] = await db
      .insert(strategies)
      .values({
        ownerId,
        clientId: clientPgId,
        projectId: projectPgId,
        objectives: [],
        kpis: [],
        roadmap: [],
        priorities: [],
        channels: [],
        automations: [],
        lastUpdated: new Date(),
      })
      .returning({ id: strategies.id });
    return row.id;
  } catch (err) {
    if (!isStrategyUniqueViolation(err)) throw err;
    // Perdimos la carrera contra otra request concurrente para el mismo
    // alcance: reutilizamos la fila que sí se insertó, no duplicamos.
    const [existing] = await db
      .select({ id: strategies.id })
      .from(strategies)
      .where(
        and(
          eq(strategies.ownerId, ownerId),
          eq(strategies.clientId, clientPgId),
          projectPgId ? eq(strategies.projectId, projectPgId) : isNull(strategies.projectId),
        ),
      )
      .limit(1);
    if (!existing) throw err;
    return existing.id;
  }
}

export async function updateStrategy(
  id: string,
  data: Partial<Omit<Strategy, "id" | "uid" | "clientId">>,
): Promise<void> {
  const { ownerId } = await requireOwner();
  const row = await resolveStrategyRow(id);
  if (!row || row.ownerId !== ownerId) throw new Error("Estrategia no encontrada");

  const set: Partial<typeof strategies.$inferInsert> = { lastUpdated: new Date() };
  if (data.objectives !== undefined) set.objectives = data.objectives;
  if (data.kpis !== undefined) set.kpis = data.kpis;
  if (data.roadmap !== undefined) set.roadmap = data.roadmap;
  if (data.priorities !== undefined) set.priorities = data.priorities;
  if (data.channels !== undefined) set.channels = data.channels;
  if (data.automations !== undefined) set.automations = data.automations;

  await db.update(strategies).set(set).where(eq(strategies.id, row.id));
}

/** Adopta una estrategia huérfana (o re-asigna una existente) a un proyecto. */
export async function assignStrategyToProject(strategyId: string, projectId: string): Promise<void> {
  const { ownerId } = await requireOwner();
  const row = await resolveStrategyRow(strategyId);
  if (!row || row.ownerId !== ownerId) throw new Error("Estrategia no encontrada");
  // El proyecto debe ser del MISMO cliente que ya tiene la estrategia — no
  // basta con que sea del mismo owner.
  const projectPgId = await resolveOwnedProjectForClientPgId(projectId, row.clientId, ownerId);
  if (!projectPgId) throw new Error("Proyecto no encontrado");
  await db.update(strategies).set({ projectId: projectPgId }).where(eq(strategies.id, row.id));
}
