'use server';

// Fase 4 (rebanada Documentos): Postgres — antes Firestore `contracts` vía
// client SDK. El `uid`/`clientId` extra de algunas firmas se conserva por
// compatibilidad pero el dueño real sale de la sesión.
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { contracts, clients, proposals, projects, billingItems } from "@/lib/db/schema";
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
 * base fija (versionada) y crea el contrato. Los conceptos de cobro
 * definidos aquí quedan guardados como `billingItemDrafts` — los
 * `billingItems` reales (los que ve Finanzas/Cobros) recién se crean al
 * firmar el contrato (ver `signContract`), no al confirmarlo.
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

  const [row] = await db
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
      billingItemDrafts: data.billingItems,
      startDate: data.startDate,
      endDate: data.endDate ?? null,
      approvedAt: new Date(),
    })
    .returning({ id: contracts.id });

  // Cualquier contrato confirmado con una propuesta vinculada deja la
  // trazabilidad en esa propuesta — sin importar si se llegó aquí desde
  // "Convertir a contrato" (ya debería estar en `aceptada`) o desde el
  // wizard genérico eligiendo la propuesta manualmente.
  if (proposalPgId) {
    await db
      .update(proposals)
      .set({ status: "aceptada", contractId: row.id, updatedAt: new Date() })
      .where(eq(proposals.id, proposalPgId));
  }

  return row.id;
}

export interface SignContractResult {
  status: Contract["status"];
  /** uuid Postgres del proyecto ya vinculado, si `attachProjectToContract` ya corrió antes. */
  projectId: string | null;
}

/**
 * Firma el contrato: pone `status: "firmado"` + `signedAt`, y crea los
 * `billingItems` reales desde los `billingItemDrafts` guardados en el
 * wizard (antes de esto, un contrato sin firmar no genera cobros en
 * Finanzas). Idempotente — si ya estaba firmado, no repite nada y solo
 * devuelve el estado actual, para que el handler de firma se pueda
 * reintentar sin duplicar cobros ni fallar.
 */
export async function signContract(id: string): Promise<SignContractResult> {
  const { ownerId } = await requireOwner();
  const row = await resolveContractRow(id);
  if (!row || row.ownerId !== ownerId) throw new Error("Contrato no encontrado");

  if (row.status === "firmado") {
    return { status: row.status, projectId: row.projectId };
  }

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
      items: (row.billingItemDrafts as BillingItemDraft[]) ?? [],
    });
  });

  return { status: "firmado", projectId: row.projectId };
}

/**
 * Vincula el proyecto CRM creado del lado cliente (`useCRM().addProject`) al
 * contrato firmado, y de paso etiqueta los `billingItems` del contrato con
 * ese proyecto. Idempotente — si el contrato ya tiene `projectId`, no lo
 * pisa (evita huérfanos si se reintenta después de que el proyecto ya quedó
 * vinculado).
 *
 * `clientProjectId` es el id que genera el cliente (`CRMProject.id`), NO el
 * uuid de Postgres — `addProject()` dispara un guardado con debounce
 * (~500ms) hacia `crm-sync.ts`, así que el proyecto puede tardar en
 * aparecer todavía. Reintenta unas cuantas veces antes de rendirse, para
 * que un solo clic del usuario no choque con esa carrera casi siempre.
 */
export async function attachProjectToContract(
  contractId: string,
  clientProjectId: string
): Promise<{ projectId: string }> {
  const { ownerId } = await requireOwner();
  const row = await resolveContractRow(contractId);
  if (!row || row.ownerId !== ownerId) throw new Error("Contrato no encontrado");
  if (row.status !== "firmado") throw new Error("El contrato todavía no está firmado");

  if (row.projectId) {
    return { projectId: row.projectId };
  }

  let projectPgId: string | null = null;
  for (let attempt = 0; attempt < 5 && !projectPgId; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 600));
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.firestoreId, clientProjectId))
      .limit(1);
    projectPgId = project?.id ?? null;
  }
  if (!projectPgId) {
    throw new Error(
      "El proyecto todavía se está guardando — espera un momento y reintenta."
    );
  }

  await db.transaction(async (tx) => {
    // El `isNull` re-verifica dentro de la transacción (contra la carrera de
    // dos clics casi simultáneos) — si otro attach ya ganó, este update no
    // toca nada y la siguiente lectura de `row.projectId` lo reflejará.
    await tx
      .update(contracts)
      .set({ projectId: projectPgId, updatedAt: new Date() })
      .where(and(eq(contracts.id, row.id), isNull(contracts.projectId)));
    await tx
      .update(billingItems)
      .set({ projectId: projectPgId })
      .where(eq(billingItems.contractId, row.id));
  });

  return { projectId: projectPgId };
}
