/**
 * Fase 4 — sincronización de sección completa para el núcleo CRM.
 *
 * `CRMContextCore.tsx` mantiene TODO el estado en memoria del lado del
 * cliente (`dataRef`) y hoy hace un guardado con debounce de la sección que
 * cambió (`clients` | `tools` | `streak` | `serverLinks` | `sessions`) contra
 * el blob `crm_data/{uid}` de Firestore. Al cortar a Postgres, cada sección
 * deja de ser "sobrescribir un campo del documento" y pasa a ser
 * "reconciliar un árbol de filas normalizadas" — insertar/actualizar por
 * `firestore_id` (el id que el cliente ya genera con `uid()`) y borrar lo
 * que ya no está en el payload.
 *
 * Se preserva DELIBERADAMENTE la interfaz pública de CRMContextCore (mismas
 * ~45 funciones, mismas firmas) — los 18 archivos que consumen `useCRM()` no
 * cambian. Solo cambia qué pasa "detrás" de `persist()`.
 */
import { and, eq, inArray } from "drizzle-orm";
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
  workSessions,
} from "@/lib/db/schema";
import { getUserStreak, setUserStreak } from "./crm";
import type {
  CRMClient,
  CRMProject,
  CRMTask,
  CRMKey,
  RecurringCharge,
  ProjectLogEntry,
  Tool,
  KnowledgeTip,
  ServerClientLink,
} from "@/types/crm";
import type { WorkSession } from "@/types/session";

function toIso(d: unknown): string {
  if (typeof d === "string") return d;
  if (d instanceof Date) return d.toISOString();
  return new Date().toISOString();
}

// Borra las filas existentes cuyo firestore_id ya no está en el payload
// (el usuario las eliminó desde el cliente).
async function deleteMissing(
  existing: Array<{ id: string; firestoreId: string | null }>,
  payloadIds: Set<string>,
  deleteByIds: (ids: string[]) => Promise<unknown>
) {
  const toDelete = existing.filter((r) => r.firestoreId && !payloadIds.has(r.firestoreId)).map((r) => r.id);
  if (toDelete.length) await deleteByIds(toDelete);
}

// ── clients (source='crm_blob') + árbol completo de projects ──────────────

export async function syncCrmClients(ownerId: string, payload: CRMClient[]): Promise<void> {
  const existing = await db
    .select({ id: clients.id, firestoreId: clients.firestoreId })
    .from(clients)
    .where(and(eq(clients.ownerId, ownerId), eq(clients.source, "crm_blob")));
  const payloadIds = new Set(payload.map((c) => c.id));
  await deleteMissing(existing, payloadIds, (ids) => db.delete(clients).where(inArray(clients.id, ids)));

  for (const c of payload) {
    const [row] = await db
      .insert(clients)
      .values({
        ownerId,
        source: "crm_blob",
        firestoreId: c.id,
        name: c.name,
        contactName: c.contactName ?? null,
        email: c.email,
        phone: c.phone,
        location: c.location,
        notes: c.notes ?? "",
        portalToken: c.portalToken ?? null,
        portalEnabled: !!c.portalEnabled,
        createdAt: new Date(toIso(c.createdAt)),
      })
      .onConflictDoUpdate({
        target: clients.firestoreId,
        set: {
          name: c.name,
          contactName: c.contactName ?? null,
          email: c.email,
          phone: c.phone,
          location: c.location,
          notes: c.notes ?? "",
          portalToken: c.portalToken ?? null,
          portalEnabled: !!c.portalEnabled,
        },
      })
      .returning({ id: clients.id });
    await syncProjectsForClient(row.id, c.projects ?? []);
  }
}

async function syncProjectsForClient(clientPgId: string, payload: CRMProject[]): Promise<void> {
  const existing = await db
    .select({ id: projects.id, firestoreId: projects.firestoreId })
    .from(projects)
    .where(eq(projects.clientId, clientPgId));
  const payloadIds = new Set(payload.map((p) => p.id));
  await deleteMissing(existing, payloadIds, (ids) => db.delete(projects).where(inArray(projects.id, ids)));

  for (const p of payload) {
    const [row] = await db
      .insert(projects)
      .values({
        firestoreId: p.id,
        clientId: clientPgId,
        name: p.name,
        domain: p.domain ?? "",
        budget: String(p.budget ?? 0),
        annual: String(p.annual ?? 0),
        budgetIva: p.budgetIva ?? "none",
        annualIva: p.annualIva ?? "none",
        tech: p.tech ?? "",
        guides: p.guides ?? "",
        accounts: p.accounts ?? "",
        readme: p.readme ?? "",
        prompt: p.prompt ?? "",
        quickNotes: p.quickNotes ?? "",
        createdAt: new Date(toIso(p.createdAt)),
      })
      .onConflictDoUpdate({
        target: projects.firestoreId,
        set: {
          name: p.name,
          domain: p.domain ?? "",
          budget: String(p.budget ?? 0),
          annual: String(p.annual ?? 0),
          budgetIva: p.budgetIva ?? "none",
          annualIva: p.annualIva ?? "none",
          tech: p.tech ?? "",
          guides: p.guides ?? "",
          accounts: p.accounts ?? "",
          readme: p.readme ?? "",
          prompt: p.prompt ?? "",
          quickNotes: p.quickNotes ?? "",
        },
      })
      .returning({ id: projects.id });
    const projectPgId = row.id;

    await Promise.all([
      syncTasks(projectPgId, p.tasks ?? []),
      syncCharges(projectPgId, p.charges ?? []),
      syncKeys(projectPgId, p.keys ?? []),
      syncLogEntries(projectPgId, p.notesLog ?? []),
    ]);
  }
}

async function syncTasks(projectPgId: string, payload: CRMTask[]): Promise<void> {
  const existing = await db
    .select({ id: tasks.id, firestoreId: tasks.firestoreId })
    .from(tasks)
    .where(eq(tasks.projectId, projectPgId));
  const payloadIds = new Set(payload.map((t) => t.id));
  await deleteMissing(existing, payloadIds, (ids) => db.delete(tasks).where(inArray(tasks.id, ids)));

  for (const t of payload) {
    await db
      .insert(tasks)
      .values({
        firestoreId: t.id,
        projectId: projectPgId,
        name: t.name,
        desc: t.desc ?? "",
        status: t.status,
        prio: t.prio,
        pomoSessions: t.pomoSessions ?? 0,
        createdAt: new Date(toIso(t.createdAt)),
      })
      .onConflictDoUpdate({
        target: tasks.firestoreId,
        set: { name: t.name, desc: t.desc ?? "", status: t.status, prio: t.prio, pomoSessions: t.pomoSessions ?? 0 },
      });
  }
}

async function syncCharges(projectPgId: string, payload: RecurringCharge[]): Promise<void> {
  const existing = await db
    .select({ id: recurringCharges.id, firestoreId: recurringCharges.firestoreId })
    .from(recurringCharges)
    .where(eq(recurringCharges.projectId, projectPgId));
  const payloadIds = new Set(payload.map((c) => c.id));
  await deleteMissing(existing, payloadIds, (ids) => db.delete(recurringCharges).where(inArray(recurringCharges.id, ids)));

  for (const c of payload) {
    const amount = String(parseFloat(String(c.amount).replace(/[^0-9.-]/g, "")) || 0);
    await db
      .insert(recurringCharges)
      .values({
        firestoreId: c.id,
        projectId: projectPgId,
        concept: c.concept ?? "",
        amount,
        frequency: c.frequency,
        startDate: toIso(c.startDate).slice(0, 10),
        clientEmail: c.clientEmail ?? "",
        active: c.active ?? true,
        lastNotified: c.lastNotified ? new Date(c.lastNotified) : null,
        createdAt: new Date(toIso(c.createdAt)),
      })
      .onConflictDoUpdate({
        target: recurringCharges.firestoreId,
        set: {
          concept: c.concept ?? "",
          amount,
          frequency: c.frequency,
          startDate: toIso(c.startDate).slice(0, 10),
          clientEmail: c.clientEmail ?? "",
          active: c.active ?? true,
          lastNotified: c.lastNotified ? new Date(c.lastNotified) : null,
        },
      });
  }
}

async function syncKeys(projectPgId: string, payload: CRMKey[]): Promise<void> {
  const existing = await db
    .select({ id: projectKeys.id, firestoreId: projectKeys.firestoreId })
    .from(projectKeys)
    .where(eq(projectKeys.projectId, projectPgId));
  const payloadIds = new Set(payload.map((k) => k.id));
  await deleteMissing(existing, payloadIds, (ids) => db.delete(projectKeys).where(inArray(projectKeys.id, ids)));

  for (const k of payload) {
    await db
      .insert(projectKeys)
      .values({ firestoreId: k.id, projectId: projectPgId, label: k.label, value: k.value })
      .onConflictDoUpdate({ target: projectKeys.firestoreId, set: { label: k.label, value: k.value } });
  }
}

async function syncLogEntries(projectPgId: string, payload: ProjectLogEntry[]): Promise<void> {
  const existing = await db
    .select({ id: projectLogEntries.id, firestoreId: projectLogEntries.firestoreId })
    .from(projectLogEntries)
    .where(eq(projectLogEntries.projectId, projectPgId));
  const payloadIds = new Set(payload.map((l) => l.id));
  await deleteMissing(existing, payloadIds, (ids) => db.delete(projectLogEntries).where(inArray(projectLogEntries.id, ids)));

  for (const l of payload) {
    await db
      .insert(projectLogEntries)
      .values({
        firestoreId: l.id,
        projectId: projectPgId,
        category: l.category,
        content: l.content,
        authorName: l.authorName,
        createdAt: new Date(toIso(l.createdAt)),
      })
      .onConflictDoUpdate({ target: projectLogEntries.firestoreId, set: { category: l.category, content: l.content } });
  }
}

// ── tools + tips ────────────────────────────────────────────────────────────

export async function syncCrmTools(ownerId: string, payload: Tool[]): Promise<void> {
  const existing = await db
    .select({ id: tools.id, firestoreId: tools.firestoreId })
    .from(tools)
    .where(eq(tools.ownerId, ownerId));
  const payloadIds = new Set(payload.map((t) => t.id));
  await deleteMissing(existing, payloadIds, (ids) => db.delete(tools).where(inArray(tools.id, ids)));

  for (const t of payload) {
    const [row] = await db
      .insert(tools)
      .values({ firestoreId: t.id, ownerId, name: t.name, icon: t.icon, color: t.color, createdAt: new Date(toIso(t.createdAt)) })
      .onConflictDoUpdate({ target: tools.firestoreId, set: { name: t.name, icon: t.icon, color: t.color } })
      .returning({ id: tools.id });
    await syncTips(row.id, t.tips ?? []);
  }
}

async function syncTips(toolPgId: string, payload: KnowledgeTip[]): Promise<void> {
  const existing = await db
    .select({ id: knowledgeTips.id, firestoreId: knowledgeTips.firestoreId })
    .from(knowledgeTips)
    .where(eq(knowledgeTips.toolId, toolPgId));
  const payloadIds = new Set(payload.map((t) => t.id));
  await deleteMissing(existing, payloadIds, (ids) => db.delete(knowledgeTips).where(inArray(knowledgeTips.id, ids)));

  for (const t of payload) {
    await db
      .insert(knowledgeTips)
      .values({
        firestoreId: t.id,
        toolId: toolPgId,
        title: t.title,
        summary: t.summary,
        content: t.content,
        tags: t.tags ?? [],
        createdAt: new Date(toIso(t.createdAt)),
        updatedAt: new Date(toIso(t.updatedAt)),
      })
      .onConflictDoUpdate({
        target: knowledgeTips.firestoreId,
        set: { title: t.title, summary: t.summary, content: t.content, tags: t.tags ?? [], updatedAt: new Date(toIso(t.updatedAt)) },
      });
  }
}

// ── streak ───────────────────────────────────────────────────────────────────

export async function syncCrmStreak(ownerId: string, value: number): Promise<void> {
  await setUserStreak(ownerId, value);
}

// ── serverLinks (projectId → clientId, ambos como firestoreId del payload) ──

export async function syncCrmServerLinks(ownerId: string, payload: ServerClientLink): Promise<void> {
  // Resuelve firestoreId -> pg id para projects/clients de este owner.
  const ownerClients = await db
    .select({ id: clients.id, firestoreId: clients.firestoreId })
    .from(clients)
    .where(and(eq(clients.ownerId, ownerId), eq(clients.source, "crm_blob")));
  const clientFsToPg = new Map(ownerClients.map((c) => [c.firestoreId, c.id]));
  const ownerClientPgIds = ownerClients.map((c) => c.id);
  const ownerProjects = ownerClientPgIds.length
    ? await db.select({ id: projects.id, firestoreId: projects.firestoreId }).from(projects).where(inArray(projects.clientId, ownerClientPgIds))
    : [];
  const projectFsToPg = new Map(ownerProjects.map((p) => [p.firestoreId, p.id]));

  const existing = await db
    .select({ projectId: serverLinks.projectId })
    .from(serverLinks)
    .where(ownerProjects.length ? inArray(serverLinks.projectId, ownerProjects.map((p) => p.id)) : eq(serverLinks.projectId, "00000000-0000-0000-0000-000000000000"));

  const payloadProjectPgIds = new Set(
    Object.keys(payload).map((fsProjectId) => projectFsToPg.get(fsProjectId)).filter((v): v is string => !!v)
  );
  const toDelete = existing.filter((r) => !payloadProjectPgIds.has(r.projectId)).map((r) => r.projectId);
  if (toDelete.length) await db.delete(serverLinks).where(inArray(serverLinks.projectId, toDelete));

  for (const [fsProjectId, fsClientId] of Object.entries(payload)) {
    const projectPgId = projectFsToPg.get(fsProjectId);
    const clientPgId = clientFsToPg.get(fsClientId);
    if (!projectPgId || !clientPgId) continue;
    await db
      .insert(serverLinks)
      .values({ projectId: projectPgId, clientId: clientPgId })
      .onConflictDoUpdate({ target: serverLinks.projectId, set: { clientId: clientPgId } });
  }
}

// ── work sessions ────────────────────────────────────────────────────────────

export async function syncCrmSessions(ownerId: string, payload: WorkSession[]): Promise<void> {
  const existing = await db
    .select({ id: workSessions.id, firestoreId: workSessions.firestoreId })
    .from(workSessions)
    .where(eq(workSessions.ownerId, ownerId));
  const payloadIds = new Set(payload.map((s) => s.id));
  await deleteMissing(existing, payloadIds, (ids) => db.delete(workSessions).where(inArray(workSessions.id, ids)));

  // clientId/projectId/taskId del payload son firestoreId — resolver a pg id.
  const ownerClients = await db
    .select({ id: clients.id, firestoreId: clients.firestoreId })
    .from(clients)
    .where(and(eq(clients.ownerId, ownerId), eq(clients.source, "crm_blob")));
  const clientFsToPg = new Map(ownerClients.map((c) => [c.firestoreId, c.id]));
  const ownerClientPgIds = ownerClients.map((c) => c.id);
  const ownerProjects = ownerClientPgIds.length
    ? await db.select({ id: projects.id, firestoreId: projects.firestoreId }).from(projects).where(inArray(projects.clientId, ownerClientPgIds))
    : [];
  const projectFsToPg = new Map(ownerProjects.map((p) => [p.firestoreId, p.id]));
  const ownerProjectPgIds = ownerProjects.map((p) => p.id);
  const ownerTasks = ownerProjectPgIds.length
    ? await db.select({ id: tasks.id, firestoreId: tasks.firestoreId }).from(tasks).where(inArray(tasks.projectId, ownerProjectPgIds))
    : [];
  const taskFsToPg = new Map(ownerTasks.map((t) => [t.firestoreId, t.id]));

  for (const s of payload) {
    await db
      .insert(workSessions)
      .values({
        firestoreId: s.id,
        ownerId,
        clientId: clientFsToPg.get(s.clientId) ?? null,
        projectId: projectFsToPg.get(s.projectId) ?? null,
        taskId: taskFsToPg.get(s.taskId) ?? null,
        clientName: s.clientName,
        projectName: s.projectName,
        taskName: s.taskName,
        startedAt: new Date(toIso(s.startedAt)),
        endedAt: s.endedAt ? new Date(s.endedAt) : null,
        durationSeconds: s.durationSeconds ?? null,
        status: s.status,
        currentActivity: s.currentActivity ?? null,
        activities: s.activities ?? [],
        notes: s.notes ?? [],
        blockers: s.blockers ?? [],
        sessionGoals: s.sessionGoals ?? [],
        deployStatus: s.deployStatus ?? null,
        commitStatus: s.commitStatus ?? null,
        createdBy: s.createdBy,
      })
      .onConflictDoUpdate({
        target: workSessions.firestoreId,
        set: {
          endedAt: s.endedAt ? new Date(s.endedAt) : null,
          durationSeconds: s.durationSeconds ?? null,
          status: s.status,
          currentActivity: s.currentActivity ?? null,
          activities: s.activities ?? [],
          notes: s.notes ?? [],
          blockers: s.blockers ?? [],
          sessionGoals: s.sessionGoals ?? [],
          deployStatus: s.deployStatus ?? null,
          commitStatus: s.commitStatus ?? null,
        },
      });
  }
}

// ── carga completa (reconstruye el shape anidado que el cliente espera) ────

export async function getFullCrmData(ownerId: string): Promise<{
  clients: CRMClient[];
  tools: Tool[];
  streak: number;
  serverLinks: ServerClientLink;
  sessions: WorkSession[];
}> {
  const clientRows = await db
    .select()
    .from(clients)
    .where(and(eq(clients.ownerId, ownerId), eq(clients.source, "crm_blob")));
  const clientPgIds = clientRows.map((c) => c.id);

  const projectRows = clientPgIds.length
    ? await db.select().from(projects).where(inArray(projects.clientId, clientPgIds))
    : [];
  const projectPgIds = projectRows.map((p) => p.id);

  const [taskRows, chargeRows, keyRows, logRows] = projectPgIds.length
    ? await Promise.all([
        db.select().from(tasks).where(inArray(tasks.projectId, projectPgIds)),
        db.select().from(recurringCharges).where(inArray(recurringCharges.projectId, projectPgIds)),
        db.select().from(projectKeys).where(inArray(projectKeys.projectId, projectPgIds)),
        db.select().from(projectLogEntries).where(inArray(projectLogEntries.projectId, projectPgIds)),
      ])
    : [[], [], [], []];

  const assembledClients: CRMClient[] = clientRows.map((c) => ({
    id: c.firestoreId ?? c.id,
    name: c.name,
    contactName: c.contactName ?? undefined,
    email: c.email ?? "",
    phone: c.phone ?? "",
    location: c.location ?? "",
    notes: c.notes,
    portalToken: c.portalToken ?? undefined,
    portalEnabled: c.portalEnabled,
    strategyId: c.strategyId ?? undefined,
    createdAt: c.createdAt.toISOString(),
    projects: projectRows
      .filter((p) => p.clientId === c.id)
      .map((p) => ({
        id: p.firestoreId ?? p.id,
        name: p.name,
        domain: p.domain,
        budget: Number(p.budget),
        annual: Number(p.annual),
        budgetIva: p.budgetIva,
        annualIva: p.annualIva,
        tech: p.tech,
        guides: p.guides,
        accounts: p.accounts,
        readme: p.readme,
        prompt: p.prompt,
        quickNotes: p.quickNotes,
        createdAt: p.createdAt.toISOString(),
        keys: keyRows
          .filter((k) => k.projectId === p.id)
          .map((k) => ({ id: k.firestoreId ?? k.id, label: k.label, value: k.value })),
        tasks: taskRows
          .filter((t) => t.projectId === p.id)
          .map((t) => ({
            id: t.firestoreId ?? t.id,
            name: t.name,
            desc: t.desc,
            status: t.status,
            prio: t.prio,
            pomoSessions: t.pomoSessions,
            createdAt: t.createdAt.toISOString(),
          })),
        charges: chargeRows
          .filter((ch) => ch.projectId === p.id)
          .map((ch) => ({
            id: ch.firestoreId ?? ch.id,
            concept: ch.concept,
            amount: ch.amount,
            frequency: ch.frequency,
            startDate: ch.startDate,
            clientEmail: ch.clientEmail,
            active: ch.active,
            lastNotified: ch.lastNotified?.toISOString(),
            createdAt: ch.createdAt.toISOString(),
          })),
        notesLog: logRows
          .filter((l) => l.projectId === p.id)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((l) => ({
            id: l.firestoreId ?? l.id,
            category: l.category,
            content: l.content,
            authorName: l.authorName,
            createdAt: l.createdAt.toISOString(),
          })),
      })),
  }));

  const toolRows = await db.select().from(tools).where(eq(tools.ownerId, ownerId));
  const toolPgIds = toolRows.map((t) => t.id);
  const tipRows = toolPgIds.length ? await db.select().from(knowledgeTips).where(inArray(knowledgeTips.toolId, toolPgIds)) : [];
  const assembledTools: Tool[] = toolRows.map((t) => ({
    id: t.firestoreId ?? t.id,
    name: t.name,
    icon: t.icon,
    color: t.color,
    createdAt: t.createdAt.toISOString(),
    tips: tipRows
      .filter((tip) => tip.toolId === t.id)
      .map((tip) => ({
        id: tip.firestoreId ?? tip.id,
        title: tip.title,
        summary: tip.summary,
        content: tip.content,
        tags: tip.tags,
        createdAt: tip.createdAt.toISOString(),
        updatedAt: tip.updatedAt.toISOString(),
      })),
  }));

  const streak = await getUserStreak(ownerId);

  const clientPgToFs = new Map(clientRows.map((c) => [c.id, c.firestoreId ?? c.id]));
  const projectPgToFs = new Map(projectRows.map((p) => [p.id, p.firestoreId ?? p.id]));
  const linkRows = projectPgIds.length
    ? await db.select().from(serverLinks).where(inArray(serverLinks.projectId, projectPgIds))
    : [];
  const assembledLinks: ServerClientLink = {};
  for (const l of linkRows) {
    const fsProjectId = projectPgToFs.get(l.projectId);
    const fsClientId = clientPgToFs.get(l.clientId);
    if (fsProjectId && fsClientId) assembledLinks[fsProjectId] = fsClientId;
  }

  const sessionRows = await db.select().from(workSessions).where(eq(workSessions.ownerId, ownerId));
  const taskPgToFs = new Map(taskRows.map((t) => [t.id, t.firestoreId ?? t.id]));
  const assembledSessions: WorkSession[] = sessionRows.map((s) => ({
    id: s.firestoreId ?? s.id,
    clientId: (s.clientId && clientPgToFs.get(s.clientId)) ?? "",
    projectId: (s.projectId && projectPgToFs.get(s.projectId)) ?? "",
    taskId: (s.taskId && taskPgToFs.get(s.taskId)) ?? "",
    clientName: s.clientName,
    projectName: s.projectName,
    taskName: s.taskName,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt?.toISOString(),
    durationSeconds: s.durationSeconds ?? undefined,
    status: s.status as WorkSession["status"],
    currentActivity: s.currentActivity ?? undefined,
    activities: s.activities as WorkSession["activities"],
    notes: s.notes as WorkSession["notes"],
    blockers: s.blockers as WorkSession["blockers"],
    sessionGoals: s.sessionGoals as WorkSession["sessionGoals"],
    deployStatus: (s.deployStatus as WorkSession["deployStatus"]) ?? undefined,
    commitStatus: s.commitStatus ?? undefined,
    createdBy: s.createdBy,
  }));

  return { clients: assembledClients, tools: assembledTools, streak, serverLinks: assembledLinks, sessions: assembledSessions };
}
