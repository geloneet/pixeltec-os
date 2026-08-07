'use server';

// Fase 4 (rebanada Documentos): Postgres — antes Firestore `invoices` vía
// client SDK. El dominio embebe items[]; Postgres los normaliza en
// invoice_items → se reensamblan al leer y se reemplazan todos al escribir.
import { and, count, desc, eq, inArray, like, sql } from "drizzle-orm";
import { db, type DB } from "@/lib/db";
import { invoices, invoiceItems, clients } from "@/lib/db/schema";
import type { Invoice, InvoiceItem } from "@/types/documents";
import { logClientActivity } from "@/lib/db/repos/client-activity";
import {
  requireOwner,
  resolveOwnedClientPgId,
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

/**
 * ESTIMATIVO — para mostrar un preview en la UI antes de crear la factura.
 * El folio real y autoritativo lo asigna `createInvoice` (vía
 * `assignInvoiceNumber`, dentro de la transacción, bajo advisory lock). No
 * usar este valor para persistir nada: dos previews concurrentes pueden ver
 * el mismo estimado — eso es esperado y no corrompe nada porque nunca se
 * escribe directamente.
 */
export async function getNextInvoiceNumber(_uid: string): Promise<string> {
  await requireOwner();
  const year = new Date().getFullYear();
  const [{ n }] = await db
    .select({ n: count() })
    .from(invoices)
    .where(like(invoices.number, `FAC-${year}-%`));
  return `FAC-${year}-${String(n + 1).padStart(3, "0")}`;
}

/** Ejecutor de transacción — mismo patrón que billing.ts/crm-sync.ts. */
type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

/**
 * Asigna el folio DENTRO de la transacción de `createInvoice` — nunca se
 * confía en un `number` que venga del payload.
 *
 * Folio COMPANY-GLOBAL por año (decisión de Miguel, ratificada 2026-08-06):
 * para la instancia actual de PixelTEC OS hay un solo emisor, así que la
 * secuencia es de toda la empresa, no por owner/usuario que la generó. Si
 * en el futuro existe tenancy/organizations comercial real, esto debe
 * reevaluarse y escoparse al issuer/organization — registrado en NeuroPIXEL,
 * sin ADR nueva solo por esto.
 *
 * `pg_advisory_xact_lock` serializa la ASIGNACIÓN por año (no solo el
 * insert): dos creaciones concurrentes del mismo año obtienen folios
 * DISTINTOS —una espera a la otra dentro del lock— en vez de que la segunda
 * simplemente falle contra `invoices_number_idx` y el usuario tenga que
 * reintentar. El lock se libera solo al terminar la transacción (variante
 * `_xact_`), así que cubre exactamente la ventana que importa.
 *
 * MAX del sufijo numérico existente, no COUNT: un hueco (una factura
 * eliminada, o renumerada a mano) haría que COUNT reutilizara un número ya
 * emitido a otro documento fiscal — MAX+1 nunca retrocede.
 */
async function assignInvoiceNumber(tx: Tx, year: number): Promise<string> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('pixeltec_os_invoice_folio'), ${year})`);

  const existing = await tx
    .select({ number: invoices.number })
    .from(invoices)
    .where(like(invoices.number, `FAC-${year}-%`));

  const maxSuffix = existing.reduce((max, row) => {
    const match = /^FAC-\d{4}-(\d+)$/.exec(row.number);
    if (!match) return max;
    const n = Number.parseInt(match[1], 10);
    return n > max ? n : max;
  }, 0);

  return `FAC-${year}-${String(maxSuffix + 1).padStart(3, "0")}`;
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
  const clientPgId = await resolveOwnedClientPgId(clientId, ownerId);
  if (!clientPgId) throw new Error("Cliente no encontrado");

  const { normalizedItems, subtotal, ivaAmount, total } = computeInvoiceTotals(
    data.items,
    data.ivaRate,
  );

  return db.transaction(async (tx) => {
    // El folio NUNCA viene de `data.number` — el cliente puede mandar
    // cualquier cosa ahí (o nada); se asigna aquí, autoritativamente.
    const number = await assignInvoiceNumber(tx, new Date().getFullYear());

    const [row] = await tx
      .insert(invoices)
      .values({
        ownerId,
        clientId: clientPgId,
        number,
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
    return { id: row.id, number };
  }).then(async ({ id: invoiceId, number }) => {
    // El folio REAL asignado por el servidor, nunca el que el cliente sugirió.
    await logClientActivity({
      ownerId,
      clientId: clientPgId,
      type: "factura_creada",
      message: `Factura emitida: ${number}`,
    });
    return invoiceId;
  });
}

export async function updateInvoice(
  id: string,
  // "number" excluido a propósito: el folio es server-owned, asignado una
  // sola vez por `createInvoice` bajo advisory lock — no puede modificarse
  // después. El tipo lo prohíbe en compilación, no solo en runtime.
  data: Partial<Omit<Invoice, "id" | "uid" | "clientId" | "createdAt" | "number">>,
): Promise<void> {
  const { ownerId } = await requireOwner();
  const invoiceRef = await resolveInvoiceRow(id);
  if (!invoiceRef || invoiceRef.ownerId !== ownerId) throw new Error("Factura no encontrada");

  const items: InvoiceItem[] | undefined = data.items;

  const activityInfo = await db.transaction(async (tx) => {
    // SELECT FOR UPDATE + revalidar DENTRO de la transacción: el `row` leído
    // antes de abrir el tx queda stale ante una carrera. Sin el lock, dos
    // requests concurrentes podían validar cada una contra el status viejo
    // ("enviada") y la segunda en escribir pisaba en silencio una transición
    // terminal (pagada/cancelada) que la primera ya había aplicado.
    const [row] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceRef.id))
      .limit(1)
      .for("update");
    if (!row) throw new Error("Factura no encontrada");

    // Máquina de estados server-side: sin esto el <select> del cliente podía
    // revertir `pagada → borrador` y borrar la evidencia del cobro sin rastro.
    if (data.status !== undefined && data.status !== row.status) {
      const allowed = INVOICE_TRANSITIONS[row.status as Invoice["status"]] ?? [];
      if (!allowed.includes(data.status)) {
        throw new Error(`Transición de factura inválida: ${row.status} → ${data.status}`);
      }
    }

    const set: Partial<typeof invoices.$inferInsert> = { updatedAt: new Date() };
    // "number" no está en `set` a propósito: el tipo de `data` ya lo excluye.
    if (data.status !== undefined) set.status = data.status;
    if (data.ivaRate !== undefined) set.ivaRate = String(data.ivaRate);
    if (data.currency !== undefined) set.currency = data.currency;
    if (data.issueDate !== undefined) set.issueDate = data.issueDate;
    if (data.dueDate !== undefined) set.dueDate = data.dueDate;
    if (data.pdfUrl !== undefined) set.pdfUrl = data.pdfUrl;
    if (data.notes !== undefined) set.notes = data.notes;

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

    // "¿Se volvió pagada?" se decide con el status LOCKED (previo real, no el
    // leído antes del tx) — misma razón que la validación de arriba.
    return {
      becamePaid: data.status === "pagada" && row.status !== "pagada",
      clientId: row.clientId,
      number: row.number,
    };
  });

  // Solo la TRANSICIÓN a pagada genera actividad — un update neutro
  // (notas, items) no ensucia el historial.
  if (activityInfo.becamePaid) {
    await logClientActivity({
      ownerId,
      clientId: activityInfo.clientId,
      type: "factura_pagada",
      message: `Factura pagada: ${activityInfo.number}`,
    });
  }
}
