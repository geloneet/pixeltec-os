'use server';

// Fase 4 (rebanada Documentos): Postgres — antes Firestore `contracts` vía
// client SDK. El `uid`/`clientId` extra de algunas firmas se conserva por
// compatibilidad pero el dueño real sale de la sesión.
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contracts, clients, proposals } from "@/lib/db/schema";
import type { Contract } from "@/types/documents";
import {
  requireOwner,
  resolveClientPgId,
  resolveContractRow,
  resolveIATemplatePgId,
  resolveProposalPgId,
  publicDocId,
  serializeContract,
} from "./pg";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getContracts(_uid: string, clientId?: string): Promise<Contract[]> {
  const { uid, ownerId } = await requireOwner();
  const conds = [eq(contracts.ownerId, ownerId)];
  if (clientId) {
    const clientPgId = await resolveClientPgId(clientId);
    if (!clientPgId) return [];
    conds.push(eq(contracts.clientId, clientPgId));
  }
  const rows = await db
    .select({ doc: contracts, clientFsId: clients.firestoreId, proposalFsId: proposals.firestoreId })
    .from(contracts)
    .innerJoin(clients, eq(contracts.clientId, clients.id))
    .leftJoin(proposals, eq(contracts.proposalId, proposals.id))
    .where(and(...conds))
    .orderBy(desc(contracts.createdAt));
  return rows.map((r) =>
    serializeContract(r.doc, r.clientFsId ?? r.doc.clientId, uid, r.proposalFsId ?? r.doc.proposalId),
  );
}

export async function getContract(id: string): Promise<Contract | null> {
  const { uid, ownerId } = await requireOwner();
  const row = await resolveContractRow(id);
  if (!row || row.ownerId !== ownerId) return null;
  const [client] = await db
    .select({ id: clients.id, firestoreId: clients.firestoreId })
    .from(clients)
    .where(eq(clients.id, row.clientId))
    .limit(1);
  let proposalPublicId: string | null = null;
  if (row.proposalId) {
    const [p] = await db
      .select({ id: proposals.id, firestoreId: proposals.firestoreId })
      .from(proposals)
      .where(eq(proposals.id, row.proposalId))
      .limit(1);
    proposalPublicId = p ? publicDocId(p) : row.proposalId;
  }
  return serializeContract(row, client ? publicDocId(client) : row.clientId, uid, proposalPublicId);
}

export async function createContract(
  _uid: string,
  clientId: string,
  data: Omit<Contract, "id" | "uid" | "clientId" | "version" | "createdAt" | "updatedAt">,
): Promise<string> {
  const { ownerId } = await requireOwner();
  const clientPgId = await resolveClientPgId(clientId);
  if (!clientPgId) throw new Error("Cliente no encontrado");

  // proposalId/templateId llegan como ids públicos → columnas uuid
  const proposalPgId = data.proposalId ? await resolveProposalPgId(data.proposalId) : null;
  const templatePgId = data.templateId
    ? (UUID_RE.test(data.templateId) ? data.templateId : await resolveIATemplatePgId(data.templateId))
    : null;

  const [row] = await db
    .insert(contracts)
    .values({
      ownerId,
      clientId: clientPgId,
      proposalId: proposalPgId,
      templateId: templatePgId,
      version: 1,
      status: data.status,
      title: data.title,
      content: data.content,
      variables: data.variables ?? {},
      signers: data.signers ?? [],
      pdfUrl: data.pdfUrl ?? null,
      notes: data.notes ?? null,
    })
    .returning({ id: contracts.id });
  return row.id;
}

export async function updateContract(
  id: string,
  data: Partial<Omit<Contract, "id" | "uid" | "clientId" | "createdAt">>,
): Promise<void> {
  const { ownerId } = await requireOwner();
  const row = await resolveContractRow(id);
  if (!row || row.ownerId !== ownerId) throw new Error("Contrato no encontrado");

  const set: Partial<typeof contracts.$inferInsert> = { updatedAt: new Date() };
  if (data.title !== undefined) set.title = data.title;
  if (data.content !== undefined) set.content = data.content;
  if (data.status !== undefined) set.status = data.status;
  if (data.variables !== undefined) set.variables = data.variables;
  if (data.signers !== undefined) set.signers = data.signers;
  if (data.pdfUrl !== undefined) set.pdfUrl = data.pdfUrl;
  if (data.notes !== undefined) set.notes = data.notes;
  if (data.version !== undefined) set.version = data.version;
  if (data.proposalId !== undefined) {
    set.proposalId = data.proposalId ? await resolveProposalPgId(data.proposalId) : null;
  }

  await db.update(contracts).set(set).where(eq(contracts.id, row.id));
}

export async function createContractVersion(
  contractId: string,
  _uid: string,
  _clientId: string,
): Promise<string> {
  const { ownerId } = await requireOwner();
  const existing = await resolveContractRow(contractId);
  if (!existing || existing.ownerId !== ownerId) {
    throw new Error(`Contract ${contractId} not found`);
  }
  const [row] = await db
    .insert(contracts)
    .values({
      ownerId: existing.ownerId,
      clientId: existing.clientId,
      proposalId: existing.proposalId,
      templateId: existing.templateId,
      version: existing.version + 1,
      status: "borrador",
      title: existing.title,
      content: existing.content,
      variables: existing.variables ?? {},
      signers: existing.signers ?? [],
      pdfUrl: null, // igual que antes: la nueva versión no hereda el PDF
      notes: existing.notes,
    })
    .returning({ id: contracts.id });
  return row.id;
}
