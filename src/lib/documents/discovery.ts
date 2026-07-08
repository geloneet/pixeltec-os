'use server';

// Fase 4 (rebanada Documentos): Postgres — antes Firestore `discovery_sessions`
// vía client SDK.
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { discoverySessions } from "@/lib/db/schema";
import type { DiscoverySession } from "@/types/documents";
import {
  requireOwner,
  resolveClientPgId,
  resolveDiscoveryRow,
  serializeDiscovery,
} from "./pg";

export async function getDiscoverySessions(
  _uid: string,
  clientId: string,
): Promise<DiscoverySession[]> {
  const { uid, ownerId } = await requireOwner();
  const clientPgId = await resolveClientPgId(clientId);
  if (!clientPgId) return [];
  const rows = await db
    .select()
    .from(discoverySessions)
    .where(and(eq(discoverySessions.ownerId, ownerId), eq(discoverySessions.clientId, clientPgId)))
    .orderBy(desc(discoverySessions.generatedAt));
  return rows.map((row) => serializeDiscovery(row, clientId, uid));
}

export async function getLatestDiscoverySession(
  _uid: string,
  clientId: string,
): Promise<DiscoverySession | null> {
  const { uid, ownerId } = await requireOwner();
  const clientPgId = await resolveClientPgId(clientId);
  if (!clientPgId) return null;
  const [row] = await db
    .select()
    .from(discoverySessions)
    .where(and(eq(discoverySessions.ownerId, ownerId), eq(discoverySessions.clientId, clientPgId)))
    .orderBy(desc(discoverySessions.generatedAt))
    .limit(1);
  return row ? serializeDiscovery(row, clientId, uid) : null;
}

export async function createDiscoverySession(
  _uid: string,
  clientId: string,
  data: Omit<DiscoverySession, "id" | "uid" | "clientId">,
): Promise<string> {
  const { ownerId } = await requireOwner();
  const clientPgId = await resolveClientPgId(clientId);
  if (!clientPgId) throw new Error("Cliente no encontrado");
  const [row] = await db
    .insert(discoverySessions)
    .values({
      ownerId,
      clientId: clientPgId,
      industry: data.industry,
      status: data.status,
      questions: data.questions ?? [],
      answers: data.answers ?? {},
      generatedAt: data.generatedAt ? new Date(data.generatedAt) : new Date(),
      completedAt: data.completedAt ? new Date(data.completedAt) : null,
    })
    .returning({ id: discoverySessions.id });
  return row.id;
}

export async function updateDiscoverySession(
  id: string,
  data: Partial<Omit<DiscoverySession, "id" | "uid" | "clientId">>,
): Promise<void> {
  const { ownerId } = await requireOwner();
  const row = await resolveDiscoveryRow(id);
  if (!row || row.ownerId !== ownerId) throw new Error("Sesión no encontrada");

  const set: Partial<typeof discoverySessions.$inferInsert> = {};
  if (data.industry !== undefined) set.industry = data.industry;
  if (data.status !== undefined) set.status = data.status;
  if (data.questions !== undefined) set.questions = data.questions;
  if (data.answers !== undefined) set.answers = data.answers;
  if (data.generatedAt !== undefined) set.generatedAt = new Date(data.generatedAt);
  if (data.completedAt !== undefined) set.completedAt = new Date(data.completedAt);
  if (Object.keys(set).length === 0) return;

  await db.update(discoverySessions).set(set).where(eq(discoverySessions.id, row.id));
}
