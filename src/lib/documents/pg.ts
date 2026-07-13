// Helpers compartidos de la capa Postgres del módulo Documentos (Fase 4).
//
// Antes: colecciones Firestore `proposals` / `contracts` / `invoices` /
// `discovery_sessions` / `strategies` / `ia_templates` accedidas con el
// client SDK desde componentes 'use client'. Ahora: Drizzle/Postgres desde
// server actions y rutas de servidor.
//
// Convenciones de frontera (mismas que src/lib/blog/pg.ts):
//   - Los ids públicos que circulan en la UI son los ids originales de
//     Firestore para filas migradas (columna firestore_id) y uuids de
//     Postgres para filas nuevas — los resolvers aceptan ambos.
//   - El shape de dominio (src/types/documents.ts) usa `uid` (Firebase UID)
//     y `clientId` (id público del cliente). Postgres usa ownerId
//     (users.id) y clientId (clients.id). Se traduce aquí.
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  clients,
  proposals,
  contracts,
  invoices,
  invoiceItems,
  discoverySessions,
  strategies,
  iaTemplates,
} from "@/lib/db/schema";
import { getSessionUid } from "@/lib/auth/session";
import type {
  Proposal,
  ProposalViewEvent,
  ProposalVersion,
  Contract,
  ContractSigner,
  ContractSection,
  Invoice,
  InvoiceItem,
  DiscoverySession,
  DiscoveryQuestion,
  Strategy,
  StrategyObjective,
  StrategyKPI,
  RoadmapItem,
  IATemplate,
  BillingItemDraft,
} from "@/types/documents";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Identidad / auth ─────────────────────────────────────────────────────────

export async function resolveOwnerPgId(firebaseUid: string): Promise<string | null> {
  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.firebaseUid, firebaseUid))
    .limit(1);
  return u?.id ?? null;
}

/**
 * Deriva el dueño desde la sesión (nunca del parámetro `uid` que manda el
 * cliente — ese se conserva solo por compatibilidad de firma y se ignora).
 */
export async function requireOwner(): Promise<{ uid: string; ownerId: string }> {
  const uid = await getSessionUid();
  if (!uid) throw new Error("No autenticado");
  const ownerId = await resolveOwnerPgId(uid);
  if (!ownerId) throw new Error("Usuario no encontrado");
  return { uid, ownerId };
}

/** Id público del cliente (firestore_id para migrados, uuid para nuevos) → clients.id. */
export async function resolveClientPgId(publicClientId: string): Promise<string | null> {
  const id = publicClientId.trim();
  const [byFs] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.firestoreId, id))
    .limit(1);
  if (byFs) return byFs.id;
  if (!UUID_RE.test(id)) return null;
  const [byId] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, id)).limit(1);
  return byId?.id ?? null;
}

/** clients.id (uuid) → id público (firestore_id si existe). */
async function clientPublicIdFor(clientPgId: string): Promise<string> {
  const [c] = await db
    .select({ fsId: clients.firestoreId })
    .from(clients)
    .where(eq(clients.id, clientPgId))
    .limit(1);
  return c?.fsId ?? clientPgId;
}

async function ownerFirebaseUidFor(ownerPgId: string): Promise<string> {
  const [u] = await db
    .select({ fu: users.firebaseUid })
    .from(users)
    .where(eq(users.id, ownerPgId))
    .limit(1);
  return u?.fu ?? "";
}

function iso(d: Date | null | undefined): string | undefined {
  return d ? d.toISOString() : undefined;
}

/** Id público del documento: prefiere el id original de Firestore. */
export function publicDocId(row: { id: string; firestoreId: string | null }): string {
  return row.firestoreId ?? row.id;
}

// ── Resolvers fila por id público (firestore_id ?? uuid) ────────────────────

export type ProposalRow = typeof proposals.$inferSelect;
export type ContractRow = typeof contracts.$inferSelect;
export type InvoiceRow = typeof invoices.$inferSelect;
export type InvoiceItemRow = typeof invoiceItems.$inferSelect;
export type DiscoveryRow = typeof discoverySessions.$inferSelect;
export type StrategyRow = typeof strategies.$inferSelect;
export type IATemplateRow = typeof iaTemplates.$inferSelect;

export async function resolveProposalRow(docId: string): Promise<ProposalRow | null> {
  const [byFs] = await db.select().from(proposals).where(eq(proposals.firestoreId, docId)).limit(1);
  if (byFs) return byFs;
  if (!UUID_RE.test(docId)) return null;
  const [byId] = await db.select().from(proposals).where(eq(proposals.id, docId)).limit(1);
  return byId ?? null;
}

export async function resolveContractRow(docId: string): Promise<ContractRow | null> {
  const [byFs] = await db.select().from(contracts).where(eq(contracts.firestoreId, docId)).limit(1);
  if (byFs) return byFs;
  if (!UUID_RE.test(docId)) return null;
  const [byId] = await db.select().from(contracts).where(eq(contracts.id, docId)).limit(1);
  return byId ?? null;
}

export async function resolveInvoiceRow(docId: string): Promise<InvoiceRow | null> {
  const [byFs] = await db.select().from(invoices).where(eq(invoices.firestoreId, docId)).limit(1);
  if (byFs) return byFs;
  if (!UUID_RE.test(docId)) return null;
  const [byId] = await db.select().from(invoices).where(eq(invoices.id, docId)).limit(1);
  return byId ?? null;
}

export async function resolveDiscoveryRow(docId: string): Promise<DiscoveryRow | null> {
  const [byFs] = await db
    .select()
    .from(discoverySessions)
    .where(eq(discoverySessions.firestoreId, docId))
    .limit(1);
  if (byFs) return byFs;
  if (!UUID_RE.test(docId)) return null;
  const [byId] = await db.select().from(discoverySessions).where(eq(discoverySessions.id, docId)).limit(1);
  return byId ?? null;
}

export async function resolveStrategyRow(docId: string): Promise<StrategyRow | null> {
  const [byFs] = await db.select().from(strategies).where(eq(strategies.firestoreId, docId)).limit(1);
  if (byFs) return byFs;
  if (!UUID_RE.test(docId)) return null;
  const [byId] = await db.select().from(strategies).where(eq(strategies.id, docId)).limit(1);
  return byId ?? null;
}

export async function resolveIATemplateRow(docId: string): Promise<IATemplateRow | null> {
  const [byFs] = await db.select().from(iaTemplates).where(eq(iaTemplates.firestoreId, docId)).limit(1);
  if (byFs) return byFs;
  if (!UUID_RE.test(docId)) return null;
  const [byId] = await db.select().from(iaTemplates).where(eq(iaTemplates.id, docId)).limit(1);
  return byId ?? null;
}

/** Id público de propuesta → proposals.id (uuid) o null. */
export async function resolveProposalPgId(publicId: string): Promise<string | null> {
  const row = await resolveProposalRow(publicId);
  return row?.id ?? null;
}

/** Id público de plantilla IA → ia_templates.id (uuid) o null. */
export async function resolveIATemplatePgId(publicId: string): Promise<string | null> {
  const row = await resolveIATemplateRow(publicId);
  return row?.id ?? null;
}

// ── Serializadores fila → shape de dominio (src/types/documents.ts) ─────────

export function serializeProposal(row: ProposalRow, clientPublicId: string, uid: string): Proposal {
  return {
    id: publicDocId(row),
    uid,
    clientId: clientPublicId,
    clientName: row.clientName,
    reference: row.reference ?? undefined,
    title: row.title,
    scope: row.scope,
    solution: row.solution ?? undefined,
    deliverables: row.deliverables ?? undefined,
    benefits: row.benefits ?? undefined,
    budget: row.budget ?? undefined,
    timeline: row.timeline ?? undefined,
    billingItemDrafts: (row.billingItemDrafts as BillingItemDraft[]) ?? [],
    status: row.status,
    contractId: row.contractId ?? undefined,
    publicToken: row.publicToken ?? undefined,
    viewCount: row.viewCount,
    viewEvents: (row.viewEvents as ProposalViewEvent[]) ?? [],
    currentVersion: row.currentVersion,
    versions: (row.versions as ProposalVersion[]) ?? [],
    sentAt: iso(row.sentAt),
    viewedAt: iso(row.viewedAt),
    acceptedAt: iso(row.acceptedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeContract(
  row: ContractRow,
  clientPublicId: string,
  uid: string,
  proposalPublicId?: string | null,
): Contract {
  return {
    id: publicDocId(row),
    uid,
    clientId: clientPublicId,
    proposalId: proposalPublicId ?? row.proposalId ?? undefined,
    templateId: row.templateId ?? undefined,
    version: row.version,
    status: row.status,
    title: row.title,
    content: row.content,
    variables: (row.variables as Record<string, string>) ?? {},
    signers: (row.signers as ContractSigner[]) ?? [],
    pdfUrl: row.pdfUrl ?? undefined,
    notes: row.notes ?? undefined,
    templateVersion: row.templateVersion,
    sections: (row.sections as ContractSection[]) ?? [],
    billingItemDrafts: (row.billingItemDrafts as BillingItemDraft[]) ?? [],
    projectId: row.projectId ?? undefined,
    startDate: row.startDate ?? undefined,
    endDate: row.endDate ?? undefined,
    approvedAt: iso(row.approvedAt),
    signedAt: iso(row.signedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeInvoiceItem(row: InvoiceItemRow): InvoiceItem {
  return {
    id: row.id,
    description: row.description,
    qty: Number(row.qty),
    unitPrice: Number(row.unitPrice),
    subtotal: Number(row.subtotal),
  };
}

export function serializeInvoice(
  row: InvoiceRow,
  items: InvoiceItemRow[],
  clientPublicId: string,
  uid: string,
): Invoice {
  return {
    id: publicDocId(row),
    uid,
    clientId: clientPublicId,
    projectId: row.projectId ?? undefined,
    number: row.number,
    status: row.status,
    items: items.map(serializeInvoiceItem),
    subtotal: Number(row.subtotal),
    ivaRate: Number(row.ivaRate),
    ivaAmount: Number(row.ivaAmount),
    total: Number(row.total),
    currency: (row.currency as Invoice["currency"]) ?? "MXN",
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    pdfUrl: row.pdfUrl ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeDiscovery(
  row: DiscoveryRow,
  clientPublicId: string,
  uid: string,
): DiscoverySession {
  return {
    id: publicDocId(row),
    uid,
    clientId: clientPublicId,
    industry: row.industry,
    status: row.status,
    questions: (row.questions as DiscoveryQuestion[]) ?? [],
    answers: (row.answers as Record<string, string>) ?? {},
    generatedAt: row.generatedAt.toISOString(),
    completedAt: iso(row.completedAt),
  };
}

export function serializeStrategy(row: StrategyRow, clientPublicId: string, uid: string): Strategy {
  return {
    id: publicDocId(row),
    uid,
    clientId: clientPublicId,
    objectives: (row.objectives as StrategyObjective[]) ?? [],
    kpis: (row.kpis as StrategyKPI[]) ?? [],
    roadmap: (row.roadmap as RoadmapItem[]) ?? [],
    priorities: row.priorities ?? [],
    channels: row.channels ?? [],
    automations: row.automations ?? [],
    lastUpdated: row.lastUpdated.toISOString(),
  };
}

export function serializeIATemplate(row: IATemplateRow, uid: string): IATemplate {
  return {
    id: publicDocId(row),
    uid,
    type: row.type,
    name: row.name,
    description: row.description,
    content: row.content,
    variables: row.variables ?? [],
    industry: row.industry ?? undefined,
    isDefault: row.isDefault,
    aiSystemPrompt: row.aiSystemPrompt ?? undefined,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ── Lecturas server-side sin sesión (rutas PDF públicas) ─────────────────────
// Estas se usan donde la identidad NO viene de la sesión sino de requireSession
// — el caller hace los checks de autorización con los valores devueltos.

/** Propuesta por id público, con uid del dueño para el check de la ruta PDF. */
export async function findProposalByPublicId(publicId: string): Promise<Proposal | null> {
  const row = await resolveProposalRow(publicId);
  if (!row) return null;
  const [clientPublicId, uid] = await Promise.all([
    clientPublicIdFor(row.clientId),
    ownerFirebaseUidFor(row.ownerId),
  ]);
  return serializeProposal(row, clientPublicId, uid);
}

/** Contrato por id público, con uid del dueño y clientId público (check IDOR portal). */
export async function findContractByPublicId(publicId: string): Promise<Contract | null> {
  const row = await resolveContractRow(publicId);
  if (!row) return null;
  const [clientPublicId, uid] = await Promise.all([
    clientPublicIdFor(row.clientId),
    ownerFirebaseUidFor(row.ownerId),
  ]);
  let proposalPublicId: string | null = null;
  if (row.proposalId) {
    const [p] = await db
      .select({ id: proposals.id, firestoreId: proposals.firestoreId })
      .from(proposals)
      .where(eq(proposals.id, row.proposalId))
      .limit(1);
    proposalPublicId = p ? publicDocId(p) : row.proposalId;
  }
  return serializeContract(row, clientPublicId, uid, proposalPublicId);
}

/** Factura por id público, con items reensamblados y uid del dueño. */
export async function findInvoiceByPublicId(publicId: string): Promise<Invoice | null> {
  const row = await resolveInvoiceRow(publicId);
  if (!row) return null;
  const [items, clientPublicId, uid] = await Promise.all([
    db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, row.id)).orderBy(invoiceItems.id),
    clientPublicIdFor(row.clientId),
    ownerFirebaseUidFor(row.ownerId),
  ]);
  return serializeInvoice(row, items, clientPublicId, uid);
}

// ── Ids ordenables para invoice_items ────────────────────────────────────────
// La tabla invoice_items no tiene columna de posición (gap del schema, que
// otro agente posee ahora mismo). Workaround: generamos los uuids con un
// prefijo aleatorio compartido por factura y el índice del item en el último
// segmento, de modo que ORDER BY id preserva el orden de captura.
export function orderedItemIds(count: number): string[] {
  const base = crypto.randomUUID().slice(0, 24); // "xxxxxxxx-xxxx-xxxx-xxxx-"
  return Array.from({ length: count }, (_, i) => `${base}${i.toString(16).padStart(12, "0")}`);
}
