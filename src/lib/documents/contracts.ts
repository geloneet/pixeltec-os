'use server';

// Fase 4 (rebanada Documentos): Postgres — antes Firestore `contracts` vía
// client SDK. El `uid`/`clientId` extra de algunas firmas se conserva por
// compatibilidad pero el dueño real sale de la sesión.
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contracts, clients, proposals } from "@/lib/db/schema";
import type { BillingItemDraft, Contract, ContractSection } from "@/types/documents";
import {
  requireOwner,
  resolveClientPgId,
  resolveContractRow,
  resolveIATemplatePgId,
  resolveProposalPgId,
  publicDocId,
  serializeContract,
} from "./pg";
import { createBillingItemsForContract } from "./billing";
import { canSignContract } from "./contract-status";
import {
  buildContractSections,
  flattenSections,
  CONTRACT_TEMPLATE_VERSION,
} from "@/lib/contracts/base-template";

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
      // `sections` (cláusulas estructuradas) y `templateVersion`/`startDate`/
      // `endDate` se quedaban en el default de la columna ([] / 1 / null) al
      // crear una versión nueva — el PDF rediseñado depende de `sections`
      // para renderizar las cláusulas numeradas, así que se heredan de la
      // versión anterior en vez de perderse.
      sections: existing.sections ?? [],
      templateVersion: existing.templateVersion,
      startDate: existing.startDate,
      endDate: existing.endDate,
      variables: existing.variables ?? {},
      signers: existing.signers ?? [],
      pdfUrl: null, // igual que antes: la nueva versión no hereda el PDF
      notes: existing.notes,
    })
    .returning({ id: contracts.id });
  return row.id;
}

export interface ConfirmContractFromWizardInput {
  clientId: string; // id público del cliente
  proposalId?: string; // id público de la propuesta relacionada, opcional
  title: string;
  startDate: string;
  endDate?: string;
  scope?: string;
  deliverables?: string;
  billingItems: BillingItemDraft[];
  /** Override opcional del cuerpo de una cláusula, por key de sección. */
  sectionOverrides?: Record<string, string>;
}

/**
 * Flujo del wizard de Contratos: genera las cláusulas desde la plantilla
 * base fija (versionada) y crea el contrato en estado "borrador" con sus
 * billing items pendientes (se convierten en cobros reales al firmar, ver
 * signContract). Si viene de una propuesta, la marca "aceptada" y la enlaza
 * al contrato en la misma transacción.
 */
export async function confirmContractFromWizard(data: ConfirmContractFromWizardInput): Promise<string> {
  if (!data.title.trim()) throw new Error("El contrato necesita un título");
  if (data.billingItems.length === 0) {
    throw new Error("Agrega al menos un concepto de cobro antes de confirmar");
  }
  if (data.billingItems.some((item) => !(item.amount > 0))) {
    throw new Error("Todos los conceptos de cobro necesitan un monto mayor a cero");
  }

  const { ownerId } = await requireOwner();
  const clientPgId = await resolveClientPgId(data.clientId);
  if (!clientPgId) throw new Error("Cliente no encontrado");

  const [client] = await db
    .select({ name: clients.name })
    .from(clients)
    .where(eq(clients.id, clientPgId))
    .limit(1);
  if (!client) throw new Error("Cliente no encontrado");

  const proposalPgId = data.proposalId ? await resolveProposalPgId(data.proposalId) : null;
  let proposalReference: string | undefined;
  if (proposalPgId) {
    const [p] = await db
      .select({ reference: proposals.reference })
      .from(proposals)
      .where(eq(proposals.id, proposalPgId))
      .limit(1);
    proposalReference = p?.reference ?? undefined;
  }

  let sections: ContractSection[] = buildContractSections({
    clientName: client.name,
    contractTitle: data.title,
    startDate: data.startDate,
    endDate: data.endDate,
    proposalReference,
    scope: data.scope,
    deliverables: data.deliverables,
    billingItems: data.billingItems,
  });
  if (data.sectionOverrides) {
    const overrides = data.sectionOverrides;
    sections = sections.map((s) => (overrides[s.key] !== undefined ? { ...s, body: overrides[s.key] } : s));
  }

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(contracts)
      .values({
        ownerId,
        clientId: clientPgId,
        proposalId: proposalPgId,
        version: 1,
        status: "borrador",
        title: data.title,
        content: flattenSections(sections),
        variables: {},
        signers: [],
        templateVersion: CONTRACT_TEMPLATE_VERSION,
        sections,
        pendingBillingItems: data.billingItems,
        startDate: data.startDate,
        endDate: data.endDate ?? null,
        approvedAt: new Date(),
      })
      .returning({ id: contracts.id });

    if (proposalPgId) {
      await tx
        .update(proposals)
        .set({ status: "aceptada", contractId: row.id, updatedAt: new Date() })
        .where(eq(proposals.id, proposalPgId));
    }

    return row.id;
  });
}

/**
 * Firma un contrato: valida la transición (canSignContract), marca
 * status="firmado" + signedAt, y crea los billing items pendientes (los
 * capturados en el wizard, guardados en `pendingBillingItems` hasta ahora)
 * en la misma transacción. createBillingItemsForContract ya es idempotente
 * por contractId — firmar dos veces por error de red no duplica cobros
 * porque el segundo intento falla en canSignContract antes de llegar ahí.
 */
export async function signContract(contractId: string): Promise<{ ok: boolean; reason?: string }> {
  const { ownerId } = await requireOwner();
  const row = await resolveContractRow(contractId);
  if (!row || row.ownerId !== ownerId) return { ok: false, reason: "not_found" };

  const transition = canSignContract(row.status);
  if (!transition.ok) return { ok: false, reason: transition.reason };

  const billingItems = (row.pendingBillingItems as BillingItemDraft[]) ?? [];

  await db.transaction(async (tx) => {
    await tx
      .update(contracts)
      .set({ status: "firmado", signedAt: new Date(), updatedAt: new Date() })
      .where(eq(contracts.id, row.id));

    await createBillingItemsForContract(tx, {
      ownerId,
      clientPgId: row.clientId,
      contractPgId: row.id,
      proposalPgId: row.proposalId,
      items: billingItems,
    });
  });

  return { ok: true };
}
