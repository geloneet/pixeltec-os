'use server';

// Fase 4 (rebanada Documentos): Postgres — antes Firestore `strategies` vía
// client SDK.
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { strategies } from "@/lib/db/schema";
import type { Strategy } from "@/types/documents";
import {
  requireOwner,
  resolveClientPgId,
  resolveStrategyRow,
  serializeStrategy,
} from "./pg";

export async function getStrategy(_uid: string, clientId: string): Promise<Strategy | null> {
  const { uid, ownerId } = await requireOwner();
  const clientPgId = await resolveClientPgId(clientId);
  if (!clientPgId) return null;
  const [row] = await db
    .select()
    .from(strategies)
    .where(and(eq(strategies.ownerId, ownerId), eq(strategies.clientId, clientPgId)))
    .limit(1);
  return row ? serializeStrategy(row, clientId, uid) : null;
}

export async function createStrategy(_uid: string, clientId: string): Promise<string> {
  const { ownerId } = await requireOwner();
  const clientPgId = await resolveClientPgId(clientId);
  if (!clientPgId) throw new Error("Cliente no encontrado");
  const [row] = await db
    .insert(strategies)
    .values({
      ownerId,
      clientId: clientPgId,
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
