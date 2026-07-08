/**
 * Repos de documentos CRM (proposals/contracts/invoices/discovery/strategies/
 * ia_templates) — Postgres/Drizzle. Ver src/lib/db/schema.ts.
 * Código nuevo, aislado — NO conectado a rutas reales todavía (Fase 0+1).
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  proposals,
  contracts,
  invoices,
  invoiceItems,
  discoverySessions,
  strategies,
  iaTemplates,
  type NewProposal,
} from "@/lib/db/schema";

// ─── Proposals ────────────────────────────────────────────────────────────

export function getProposalsByOwner(ownerId: string) {
  return db.select().from(proposals).where(eq(proposals.ownerId, ownerId)).orderBy(desc(proposals.createdAt));
}

export function getProposalByPublicToken(token: string) {
  return db
    .select()
    .from(proposals)
    .where(eq(proposals.publicToken, token))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export function createProposal(data: NewProposal) {
  return db.insert(proposals).values(data).returning().then((rows) => rows[0]);
}

// ─── Contracts ────────────────────────────────────────────────────────────
// Nota IDOR (auditoría de seguridad): al resolver por token de portal,
// validar SIEMPRE contracts.clientId contra el clientId de la sesión —
// no solo ownerId (owner es compartido entre todos los clientes de un
// mismo consultor).

export function getContractsByClient(clientId: string) {
  return db.select().from(contracts).where(eq(contracts.clientId, clientId));
}

export function getContractForPortal(contractId: string, clientId: string) {
  return db
    .select()
    .from(contracts)
    .where(and(eq(contracts.id, contractId), eq(contracts.clientId, clientId)))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

// ─── Invoices ─────────────────────────────────────────────────────────────

export function getInvoicesByOwner(ownerId: string) {
  return db.select().from(invoices).where(eq(invoices.ownerId, ownerId)).orderBy(desc(invoices.createdAt));
}

export function getInvoiceItems(invoiceId: string) {
  return db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
}

// ─── Discovery sessions ───────────────────────────────────────────────────

export function getDiscoverySessionsByClient(clientId: string) {
  return db.select().from(discoverySessions).where(eq(discoverySessions.clientId, clientId));
}

// ─── Strategies ───────────────────────────────────────────────────────────

export function getStrategyByClient(clientId: string) {
  return db
    .select()
    .from(strategies)
    .where(eq(strategies.clientId, clientId))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

// ─── IA templates ─────────────────────────────────────────────────────────

export function getIaTemplatesByOwner(ownerId: string) {
  return db.select().from(iaTemplates).where(eq(iaTemplates.ownerId, ownerId));
}
