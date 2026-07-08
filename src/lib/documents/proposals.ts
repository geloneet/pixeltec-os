'use server';

// Fase 4 (rebanada Documentos): Postgres — antes Firestore `proposals` vía
// client SDK. Ahora server actions; el `uid` de la firma se conserva por
// compatibilidad pero se ignora: el dueño real sale de la sesión.
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposals, clients } from "@/lib/db/schema";
import type { Proposal, ProposalVersion } from "@/types/documents";
import {
  requireOwner,
  resolveClientPgId,
  resolveContractRow,
  resolveProposalRow,
  serializeProposal,
} from "./pg";

export async function getProposals(_uid: string, clientId?: string): Promise<Proposal[]> {
  const { uid, ownerId } = await requireOwner();
  const conds = [eq(proposals.ownerId, ownerId)];
  if (clientId) {
    const clientPgId = await resolveClientPgId(clientId);
    if (!clientPgId) return [];
    conds.push(eq(proposals.clientId, clientPgId));
  }
  const rows = await db
    .select({ doc: proposals, clientFsId: clients.firestoreId })
    .from(proposals)
    .innerJoin(clients, eq(proposals.clientId, clients.id))
    .where(and(...conds))
    .orderBy(desc(proposals.createdAt));
  return rows.map((r) => serializeProposal(r.doc, r.clientFsId ?? r.doc.clientId, uid));
}

export async function createProposal(
  _uid: string,
  clientId: string,
  clientName: string,
  data: Omit<Proposal, "id" | "uid" | "clientId" | "clientName" | "reference" | "createdAt" | "updatedAt">,
): Promise<string> {
  const { ownerId } = await requireOwner();
  const clientPgId = await resolveClientPgId(clientId);
  if (!clientPgId) throw new Error("Cliente no encontrado");

  const [row] = await db
    .insert(proposals)
    .values({
      ownerId,
      clientId: clientPgId,
      clientName,
      title: data.title,
      scope: data.scope,
      solution: data.solution ?? null,
      deliverables: data.deliverables ?? null,
      benefits: data.benefits ?? null,
      budget: data.budget ?? null,
      timeline: data.timeline ?? null,
      status: data.status,
      currentVersion: 1,
    })
    .returning({ id: proposals.id });

  // Referencia derivada del id, igual que antes (PT-YYYY-XXXXXX)
  const reference = `PT-${new Date().getFullYear()}-${row.id.slice(0, 6).toUpperCase()}`;
  await db.update(proposals).set({ reference }).where(eq(proposals.id, row.id));
  return row.id;
}

export async function updateProposal(
  id: string,
  data: Partial<Omit<Proposal, "id" | "uid" | "clientId" | "createdAt">>,
): Promise<void> {
  const { ownerId } = await requireOwner();
  const row = await resolveProposalRow(id);
  if (!row || row.ownerId !== ownerId) throw new Error("Propuesta no encontrada");

  const set: Partial<typeof proposals.$inferInsert> = { updatedAt: new Date() };
  if (data.clientName !== undefined) set.clientName = data.clientName;
  if (data.title !== undefined) set.title = data.title;
  if (data.scope !== undefined) set.scope = data.scope;
  if (data.solution !== undefined) set.solution = data.solution;
  if (data.deliverables !== undefined) set.deliverables = data.deliverables;
  if (data.benefits !== undefined) set.benefits = data.benefits;
  if (data.budget !== undefined) set.budget = data.budget;
  if (data.timeline !== undefined) set.timeline = data.timeline;
  if (data.status !== undefined) set.status = data.status;
  if (data.publicToken !== undefined) set.publicToken = data.publicToken;
  if (data.viewCount !== undefined) set.viewCount = data.viewCount;
  if (data.viewEvents !== undefined) set.viewEvents = data.viewEvents;
  if (data.currentVersion !== undefined) set.currentVersion = data.currentVersion;
  if (data.versions !== undefined) set.versions = data.versions;
  if (data.sentAt !== undefined) set.sentAt = new Date(data.sentAt);
  if (data.viewedAt !== undefined) set.viewedAt = new Date(data.viewedAt);
  if (data.acceptedAt !== undefined) set.acceptedAt = new Date(data.acceptedAt);
  if (data.contractId !== undefined) {
    // El dominio maneja el id público del contrato; la columna es uuid FK.
    const contract = await resolveContractRow(data.contractId);
    if (!contract) throw new Error("Contrato no encontrado");
    set.contractId = contract.id;
  }

  await db.update(proposals).set(set).where(eq(proposals.id, row.id));
}

/** Generate or refresh the public token for a proposal. Creates a version snapshot. */
export async function publishProposal(proposal: Proposal): Promise<string> {
  const { ownerId } = await requireOwner();
  const row = await resolveProposalRow(proposal.id);
  if (!row || row.ownerId !== ownerId) throw new Error("Propuesta no encontrada");

  const now = new Date();

  // Token: 16 hex chars aleatorios (igual que antes)
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  const token = Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");

  const nextVersion = (row.currentVersion ?? 1) + (row.publicToken ? 1 : 0);

  const versionSnapshot: ProposalVersion = {
    version: nextVersion,
    savedAt: now.toISOString(),
    title: row.title,
    scope: row.scope,
    solution: row.solution ?? undefined,
    deliverables: row.deliverables ?? undefined,
    benefits: row.benefits ?? undefined,
    budget: row.budget ?? undefined,
    timeline: row.timeline ?? undefined,
  };

  const prevVersions = (row.versions as ProposalVersion[]) ?? [];
  const newVersions = [...prevVersions, versionSnapshot].slice(-10); // keep last 10

  await db
    .update(proposals)
    .set({
      publicToken: token,
      currentVersion: nextVersion,
      versions: newVersions,
      updatedAt: now,
      ...(row.status === "borrador" ? { status: "enviada" as const } : {}),
      ...(!row.sentAt ? { sentAt: now } : {}),
    })
    .where(eq(proposals.id, row.id));

  return token;
}
