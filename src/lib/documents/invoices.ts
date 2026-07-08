'use server';

// Fase 4 (rebanada Documentos): Postgres — antes Firestore `invoices` vía
// client SDK. El dominio embebe items[]; Postgres los normaliza en
// invoice_items → se reensamblan al leer y se reemplazan todos al escribir.
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices, invoiceItems, clients } from "@/lib/db/schema";
import type { Invoice, InvoiceItem } from "@/types/documents";
import {
  requireOwner,
  resolveClientPgId,
  resolveInvoiceRow,
  serializeInvoice,
  orderedItemIds,
  type InvoiceItemRow,
} from "./pg";

export async function getInvoices(_uid: string, clientId?: string): Promise<Invoice[]> {
  const { uid, ownerId } = await requireOwner();
  const conds = [eq(invoices.ownerId, ownerId)];
  if (clientId) {
    const clientPgId = await resolveClientPgId(clientId);
    if (!clientPgId) return [];
    conds.push(eq(invoices.clientId, clientPgId));
  }
  const rows = await db
    .select({ doc: invoices, clientFsId: clients.firestoreId })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(and(...conds))
    .orderBy(desc(invoices.createdAt));
  if (rows.length === 0) return [];

  const itemRows = await db
    .select()
    .from(invoiceItems)
    .where(inArray(invoiceItems.invoiceId, rows.map((r) => r.doc.id)))
    .orderBy(invoiceItems.id);
  const byInvoice = new Map<string, InvoiceItemRow[]>();
  for (const it of itemRows) {
    const list = byInvoice.get(it.invoiceId) ?? [];
    list.push(it);
    byInvoice.set(it.invoiceId, list);
  }

  return rows.map((r) =>
    serializeInvoice(r.doc, byInvoice.get(r.doc.id) ?? [], r.clientFsId ?? r.doc.clientId, uid),
  );
}

export async function getNextInvoiceNumber(_uid: string): Promise<string> {
  const { ownerId } = await requireOwner();
  const [{ n }] = await db
    .select({ n: count() })
    .from(invoices)
    .where(eq(invoices.ownerId, ownerId));
  const year = new Date().getFullYear();
  return `FAC-${year}-${String(n + 1).padStart(3, "0")}`;
}

export async function createInvoice(
  _uid: string,
  clientId: string,
  data: Omit<Invoice, "id" | "uid" | "clientId" | "createdAt" | "updatedAt">,
): Promise<string> {
  const { ownerId } = await requireOwner();
  const clientPgId = await resolveClientPgId(clientId);
  if (!clientPgId) throw new Error("Cliente no encontrado");

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(invoices)
      .values({
        ownerId,
        clientId: clientPgId,
        number: data.number,
        status: data.status,
        subtotal: String(data.subtotal),
        ivaRate: String(data.ivaRate),
        ivaAmount: String(data.ivaAmount),
        total: String(data.total),
        currency: data.currency ?? "MXN",
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        pdfUrl: data.pdfUrl ?? null,
        notes: data.notes ?? null,
      })
      .returning({ id: invoices.id });

    if (data.items.length > 0) {
      const ids = orderedItemIds(data.items.length);
      await tx.insert(invoiceItems).values(
        data.items.map((it, i) => ({
          id: ids[i],
          invoiceId: row.id,
          description: it.description,
          qty: String(it.qty),
          unitPrice: String(it.unitPrice),
          subtotal: String(it.subtotal),
        })),
      );
    }
    return row.id;
  });
}

export async function updateInvoice(
  id: string,
  data: Partial<Omit<Invoice, "id" | "uid" | "clientId" | "createdAt">>,
): Promise<void> {
  const { ownerId } = await requireOwner();
  const row = await resolveInvoiceRow(id);
  if (!row || row.ownerId !== ownerId) throw new Error("Factura no encontrada");

  const set: Partial<typeof invoices.$inferInsert> = { updatedAt: new Date() };
  if (data.number !== undefined) set.number = data.number;
  if (data.status !== undefined) set.status = data.status;
  if (data.subtotal !== undefined) set.subtotal = String(data.subtotal);
  if (data.ivaRate !== undefined) set.ivaRate = String(data.ivaRate);
  if (data.ivaAmount !== undefined) set.ivaAmount = String(data.ivaAmount);
  if (data.total !== undefined) set.total = String(data.total);
  if (data.currency !== undefined) set.currency = data.currency;
  if (data.issueDate !== undefined) set.issueDate = data.issueDate;
  if (data.dueDate !== undefined) set.dueDate = data.dueDate;
  if (data.pdfUrl !== undefined) set.pdfUrl = data.pdfUrl;
  if (data.notes !== undefined) set.notes = data.notes;

  const items: InvoiceItem[] | undefined = data.items;

  await db.transaction(async (tx) => {
    await tx.update(invoices).set(set).where(eq(invoices.id, row.id));
    if (items !== undefined) {
      // Replace-all: el dominio manda la lista completa
      await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, row.id));
      if (items.length > 0) {
        const ids = orderedItemIds(items.length);
        await tx.insert(invoiceItems).values(
          items.map((it, i) => ({
            id: ids[i],
            invoiceId: row.id,
            description: it.description,
            qty: String(it.qty),
            unitPrice: String(it.unitPrice),
            subtotal: String(it.subtotal),
          })),
        );
      }
    }
  });
}
