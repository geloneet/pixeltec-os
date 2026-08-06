'use server';

// Fase 4 (rebanada Documentos): Postgres — antes Firestore `invoices` vía
// client SDK. El dominio embebe items[]; Postgres los normaliza en
// invoice_items → se reensamblan al leer y se reemplazan todos al escribir.
import { and, count, desc, eq, inArray, like } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices, invoiceItems, clients } from "@/lib/db/schema";
import type { Invoice, InvoiceItem } from "@/types/documents";
import { logClientActivity } from "@/lib/db/repos/client-activity";
import {
  requireOwner,
  resolveClientPgId,
  resolveOwnedClientPgId,
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
  const year = new Date().getFullYear();
  // Escopado al año del folio: contar TODAS las facturas históricas hacía que
  // la primera de un año nuevo saliera como FAC-2027-048 en vez de -001.
  // Sigue siendo count-then-insert: ante doble submit el uniqueIndex de
  // `invoices.number` rechaza el duplicado (fallo seguro, no corrupción).
  const [{ n }] = await db
    .select({ n: count() })
    .from(invoices)
    .where(and(eq(invoices.ownerId, ownerId), like(invoices.number, `FAC-${year}-%`)));
  return `FAC-${year}-${String(n + 1).padStart(3, "0")}`;
}

/** Redondeo a centavos: los floats de qty*unitPrice descuadraban total vs
 * subtotal+iva al castear a numeric(12,2) columna por columna. */
function roundCents(x: number): number {
  return Math.round(x * 100) / 100;
}

/**
 * Única fuente de los montos persistidos: la factura es un documento fiscal;
 * los totales calculados en el navegador no se confían — se recalculan aquí
 * desde las líneas (y cada línea desde qty × unitPrice).
 */
function computeInvoiceTotals(items: InvoiceItem[], ivaRate: number) {
  const normalizedItems = items.map((it) => ({
    ...it,
    subtotal: roundCents(it.qty * it.unitPrice),
  }));
  const subtotal = roundCents(normalizedItems.reduce((s, it) => s + it.subtotal, 0));
  const ivaAmount = roundCents(subtotal * ivaRate);
  const total = roundCents(subtotal + ivaAmount);
  return { normalizedItems, subtotal, ivaAmount, total };
}

/** Transiciones válidas de estado — `pagada` y `cancelada` son terminales:
 * revertir una factura pagada a borrador borraba la evidencia del cobro. */
const INVOICE_TRANSITIONS: Record<Invoice["status"], Invoice["status"][]> = {
  borrador: ["enviada", "vista", "pagada", "cancelada"],
  enviada: ["vista", "pagada", "vencida", "cancelada"],
  vista: ["pagada", "vencida", "cancelada"],
  vencida: ["pagada", "cancelada"],
  pagada: [],
  cancelada: [],
};

export async function createInvoice(
  _uid: string,
  clientId: string,
  data: Omit<Invoice, "id" | "uid" | "clientId" | "createdAt" | "updatedAt">,
): Promise<string> {
  const { ownerId } = await requireOwner();
  // Verificado contra el dueño (mismo criterio que propuestas y contratos): una
  // factura es un documento fiscal y no debe poder emitirse sobre el cliente de
  // otro owner.
  const clientPgId = await resolveOwnedClientPgId(clientId, ownerId);
  if (!clientPgId) throw new Error("Cliente no encontrado");

  const { normalizedItems, subtotal, ivaAmount, total } = computeInvoiceTotals(
    data.items,
    data.ivaRate,
  );

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(invoices)
      .values({
        ownerId,
        clientId: clientPgId,
        number: data.number,
        status: data.status,
        subtotal: String(subtotal),
        ivaRate: String(data.ivaRate),
        ivaAmount: String(ivaAmount),
        total: String(total),
        currency: data.currency ?? "MXN",
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        pdfUrl: data.pdfUrl ?? null,
        notes: data.notes ?? null,
      })
      .returning({ id: invoices.id });

    if (normalizedItems.length > 0) {
      const ids = orderedItemIds(normalizedItems.length);
      await tx.insert(invoiceItems).values(
        normalizedItems.map((it, i) => ({
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
  }).then(async (invoiceId) => {
    await logClientActivity({
      ownerId,
      clientId: clientPgId,
      type: "factura_creada",
      message: `Factura emitida: ${data.number}`,
    });
    return invoiceId;
  });
}

export async function updateInvoice(
  id: string,
  data: Partial<Omit<Invoice, "id" | "uid" | "clientId" | "createdAt">>,
): Promise<void> {
  const { ownerId } = await requireOwner();
  const row = await resolveInvoiceRow(id);
  if (!row || row.ownerId !== ownerId) throw new Error("Factura no encontrada");

  // Máquina de estados server-side: sin esto el <select> del cliente podía
  // revertir `pagada → borrador` y borrar la evidencia del cobro sin rastro.
  if (data.status !== undefined && data.status !== row.status) {
    const allowed = INVOICE_TRANSITIONS[row.status as Invoice["status"]] ?? [];
    if (!allowed.includes(data.status)) {
      throw new Error(`Transición de factura inválida: ${row.status} → ${data.status}`);
    }
  }

  const set: Partial<typeof invoices.$inferInsert> = { updatedAt: new Date() };
  if (data.number !== undefined) set.number = data.number;
  if (data.status !== undefined) set.status = data.status;
  if (data.ivaRate !== undefined) set.ivaRate = String(data.ivaRate);
  if (data.currency !== undefined) set.currency = data.currency;
  if (data.issueDate !== undefined) set.issueDate = data.issueDate;
  if (data.dueDate !== undefined) set.dueDate = data.dueDate;
  if (data.pdfUrl !== undefined) set.pdfUrl = data.pdfUrl;
  if (data.notes !== undefined) set.notes = data.notes;

  const items: InvoiceItem[] | undefined = data.items;

  await db.transaction(async (tx) => {
    // Los montos NO se toman del payload: se recalculan desde las líneas que
    // quedarán persistidas (las nuevas si vienen, las existentes si no) para
    // que subtotal/iva/total siempre cuadren con los items — documento fiscal.
    const touchesMoney =
      items !== undefined ||
      data.ivaRate !== undefined ||
      data.subtotal !== undefined ||
      data.ivaAmount !== undefined ||
      data.total !== undefined;
    if (touchesMoney) {
      const effectiveItems: InvoiceItem[] =
        items !== undefined
          ? items
          : (
              await tx
                .select()
                .from(invoiceItems)
                .where(eq(invoiceItems.invoiceId, row.id))
                .orderBy(invoiceItems.id)
            ).map((it) => ({
              id: it.id,
              description: it.description,
              qty: Number(it.qty),
              unitPrice: Number(it.unitPrice),
              subtotal: Number(it.subtotal),
            }));
      const ivaRate = data.ivaRate ?? Number(row.ivaRate);
      const { subtotal, ivaAmount, total } = computeInvoiceTotals(effectiveItems, ivaRate);
      set.subtotal = String(subtotal);
      set.ivaAmount = String(ivaAmount);
      set.total = String(total);
    }

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
            subtotal: String(roundCents(it.qty * it.unitPrice)),
          })),
        );
      }
    }
  });

  // Solo la TRANSICIÓN a pagada genera actividad — un update neutro
  // (notas, items) no ensucia el historial.
  if (data.status === "pagada" && row.status !== "pagada") {
    await logClientActivity({
      ownerId,
      clientId: row.clientId,
      type: "factura_pagada",
      message: `Factura pagada: ${row.number}`,
    });
  }
}
