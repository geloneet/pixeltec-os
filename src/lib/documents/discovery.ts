'use server';

// Fase 4 (rebanada Documentos): Postgres — antes Firestore `discovery_sessions`
// vía client SDK. ADR-0034: el discovery pertenece a un PROYECTO; las
// sesiones históricas sin proyecto (project_id NULL) siguen visibles desde
// cualquier proyecto del cliente y se adoptan con `assignDiscoveryToProject`.
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { discoverySessions, projects } from "@/lib/db/schema";
import type { DiscoverySession } from "@/types/documents";
import {
  requireOwner,
  resolveOwnedClientPgId,
  resolveOwnedProjectPgId,
  resolveClientPgId,
  resolveProjectPgId,
  resolveDiscoveryRow,
  serializeDiscovery,
} from "./pg";

/** projects.id (pg) → id público, en lote (para serializar N filas sin N queries). */
async function projectPublicIdMap(projectPgIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(projectPgIds)];
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: projects.id, fsId: projects.firestoreId })
    .from(projects)
    .where(inArray(projects.id, ids));
  return new Map(rows.map((p) => [p.id, p.fsId ?? p.id]));
}

export async function getDiscoverySessions(
  _uid: string,
  clientId: string,
  projectId?: string,
): Promise<DiscoverySession[]> {
  const { uid, ownerId } = await requireOwner();
  const clientPgId = await resolveClientPgId(clientId);
  if (!clientPgId) return [];

  const filters = [eq(discoverySessions.ownerId, ownerId), eq(discoverySessions.clientId, clientPgId)];
  let projectPgId: string | null = null;
  if (projectId) {
    projectPgId = await resolveProjectPgId(projectId);
    if (!projectPgId) return [];
    // Las huérfanas (NULL) se incluyen a propósito: no se pierde historia.
    filters.push(or(eq(discoverySessions.projectId, projectPgId), isNull(discoverySessions.projectId))!);
  }

  const rows = await db
    .select()
    .from(discoverySessions)
    .where(and(...filters))
    .orderBy(desc(discoverySessions.generatedAt));

  // Mismo criterio que getStrategy: la sesión PROPIA del proyecto va antes que
  // cualquier huérfana, aunque la huérfana sea más reciente. Sin esto, en un
  // cliente multi-proyecto el tab Discovery del Proyecto A podía cargar (y
  // luego sobrescribir o adoptar) una sesión que correspondía al Proyecto B.
  if (projectPgId) {
    const pid = projectPgId;
    rows.sort((a, b) => Number(b.projectId === pid) - Number(a.projectId === pid));
  }

  const pubMap = await projectPublicIdMap(rows.flatMap((r) => (r.projectId ? [r.projectId] : [])));
  return rows.map((row) =>
    serializeDiscovery(row, clientId, uid, row.projectId ? (pubMap.get(row.projectId) ?? row.projectId) : null)
  );
}

export async function getLatestDiscoverySession(
  _uid: string,
  clientId: string,
  projectId?: string,
): Promise<DiscoverySession | null> {
  const sessions = await getDiscoverySessions(_uid, clientId, projectId);
  return sessions[0] ?? null;
}

export async function createDiscoverySession(
  _uid: string,
  clientId: string,
  data: Omit<DiscoverySession, "id" | "uid" | "clientId">,
  projectId?: string,
): Promise<string> {
  const { ownerId } = await requireOwner();
  const clientPgId = await resolveOwnedClientPgId(clientId, ownerId);
  if (!clientPgId) throw new Error("Cliente no encontrado");
  // Un projectId ajeno debe fallar, no degradar a `null`: si no, la sesión se
  // crearía huérfana en vez de rechazarse, ocultando el intento.
  const projectPgId = projectId ? await resolveOwnedProjectPgId(projectId, ownerId) : null;
  if (projectId && !projectPgId) throw new Error("Proyecto no encontrado");
  const [row] = await db
    .insert(discoverySessions)
    .values({
      ownerId,
      clientId: clientPgId,
      projectId: projectPgId,
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

/** Adopta una sesión huérfana (o re-asigna una existente) a un proyecto. */
export async function assignDiscoveryToProject(sessionId: string, projectId: string): Promise<void> {
  const { ownerId } = await requireOwner();
  const row = await resolveDiscoveryRow(sessionId);
  if (!row || row.ownerId !== ownerId) throw new Error("Sesión no encontrada");
  const projectPgId = await resolveOwnedProjectPgId(projectId, ownerId);
  if (!projectPgId) throw new Error("Proyecto no encontrado");
  await db.update(discoverySessions).set({ projectId: projectPgId }).where(eq(discoverySessions.id, row.id));
}
