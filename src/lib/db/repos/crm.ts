/**
 * Repos del núcleo CRM (Postgres/Drizzle) — reemplazan el blob `crm_data/{uid}`
 * de Firestore. Ver src/lib/db/schema.ts para el modelo relacional completo.
 *
 * NOTA: código nuevo, aislado — todavía NO conectado a ninguna ruta real
 * (Fase 0+1 de la migración). Firestore sigue siendo el datastore en vivo.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  clients,
  projects,
  projectKeys,
  tasks,
  recurringCharges,
  projectLogEntries,
  tools,
  knowledgeTips,
  serverLinks,
  userStreak,
  type NewClient,
  type NewProject,
  type NewTask,
  type NewRecurringCharge,
} from "@/lib/db/schema";

// ─── Clients ──────────────────────────────────────────────────────────────

export function getClientsByOwner(ownerId: string) {
  return db.select().from(clients).where(eq(clients.ownerId, ownerId)).orderBy(desc(clients.createdAt));
}

export function getClientById(clientId: string, ownerId: string) {
  return db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.ownerId, ownerId)))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export function createClient(data: NewClient) {
  return db.insert(clients).values(data).returning().then((rows) => rows[0]);
}

export function updateClient(clientId: string, ownerId: string, data: Partial<NewClient>) {
  return db
    .update(clients)
    .set(data)
    .where(and(eq(clients.id, clientId), eq(clients.ownerId, ownerId)))
    .returning()
    .then((rows) => rows[0] ?? null);
}

export function deleteClient(clientId: string, ownerId: string) {
  return db.delete(clients).where(and(eq(clients.id, clientId), eq(clients.ownerId, ownerId)));
}

// ─── Projects ─────────────────────────────────────────────────────────────

export function getProjectsByClient(clientId: string) {
  return db.select().from(projects).where(eq(projects.clientId, clientId)).orderBy(desc(projects.createdAt));
}

export function createProject(data: NewProject) {
  return db.insert(projects).values(data).returning().then((rows) => rows[0]);
}

export function updateProject(projectId: string, data: Partial<NewProject>) {
  return db.update(projects).set(data).where(eq(projects.id, projectId)).returning().then((rows) => rows[0] ?? null);
}

export function deleteProject(projectId: string) {
  return db.delete(projects).where(eq(projects.id, projectId));
}

// ─── Project keys ─────────────────────────────────────────────────────────

export function getProjectKeys(projectId: string) {
  return db.select().from(projectKeys).where(eq(projectKeys.projectId, projectId));
}

export function addProjectKey(projectId: string, label: string, value: string) {
  return db.insert(projectKeys).values({ projectId, label, value }).returning().then((rows) => rows[0]);
}

// ─── Tasks ────────────────────────────────────────────────────────────────

export function getTasksByProject(projectId: string) {
  return db.select().from(tasks).where(eq(tasks.projectId, projectId)).orderBy(desc(tasks.createdAt));
}

export function createTask(projectId: string, data: Omit<NewTask, "projectId">) {
  return db
    .insert(tasks)
    .values({ ...data, projectId })
    .returning()
    .then((rows) => rows[0]);
}

export function updateTaskStatus(taskId: string, status: (typeof tasks.$inferSelect)["status"]) {
  return db.update(tasks).set({ status }).where(eq(tasks.id, taskId)).returning().then((rows) => rows[0] ?? null);
}

export function deleteTask(taskId: string) {
  return db.delete(tasks).where(eq(tasks.id, taskId));
}

// ─── Recurring charges ──────────────────────────────────────────────────────
// `amount` es numeric (no string libre) — corrige el bug de la auditoría de
// seguridad donde "1,500"/"$500" producía NaN en los totales.

export function getChargesByProject(projectId: string) {
  return db
    .select()
    .from(recurringCharges)
    .where(eq(recurringCharges.projectId, projectId))
    .orderBy(desc(recurringCharges.createdAt));
}

export function addRecurringCharge(projectId: string, data: Omit<NewRecurringCharge, "projectId">) {
  return db
    .insert(recurringCharges)
    .values({ ...data, projectId })
    .returning()
    .then((rows) => rows[0]);
}

export function markChargeNotified(chargeId: string, when: Date) {
  return db
    .update(recurringCharges)
    .set({ lastNotified: when })
    .where(eq(recurringCharges.id, chargeId))
    .returning()
    .then((rows) => rows[0] ?? null);
}

// ─── Project log (bitácora) ─────────────────────────────────────────────────

export function getProjectLog(projectId: string) {
  return db
    .select()
    .from(projectLogEntries)
    .where(eq(projectLogEntries.projectId, projectId))
    .orderBy(desc(projectLogEntries.createdAt));
}

export function addProjectLogEntry(
  projectId: string,
  entry: { category: (typeof projectLogEntries.$inferSelect)["category"]; content: string; authorName: string }
) {
  return db
    .insert(projectLogEntries)
    .values({ projectId, ...entry })
    .returning()
    .then((rows) => rows[0]);
}

// ─── Tools / knowledge base ─────────────────────────────────────────────────

export function getToolsByOwner(ownerId: string) {
  return db.select().from(tools).where(eq(tools.ownerId, ownerId));
}

export function getKnowledgeTips(toolId: string) {
  return db.select().from(knowledgeTips).where(eq(knowledgeTips.toolId, toolId));
}

// ─── Server links (projectId → clientId) ──────────────────────────────────

export function linkProjectToClient(projectId: string, clientId: string) {
  return db
    .insert(serverLinks)
    .values({ projectId, clientId })
    .onConflictDoUpdate({ target: serverLinks.projectId, set: { clientId } })
    .returning()
    .then((rows) => rows[0]);
}

export function unlinkProject(projectId: string) {
  return db.delete(serverLinks).where(eq(serverLinks.projectId, projectId));
}

// ─── Streak ─────────────────────────────────────────────────────────────────

export function getUserStreak(ownerId: string) {
  return db
    .select()
    .from(userStreak)
    .where(eq(userStreak.userId, ownerId))
    .limit(1)
    .then((rows) => rows[0]?.value ?? 0);
}

export function setUserStreak(ownerId: string, value: number) {
  return db
    .insert(userStreak)
    .values({ userId: ownerId, value })
    .onConflictDoUpdate({ target: userStreak.userId, set: { value, updatedAt: new Date() } });
}
