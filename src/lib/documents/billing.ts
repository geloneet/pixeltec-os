'use server';

// Cobros — puente Contrato → Cobro → Pago → Próximo cobro. Tablas nuevas
// (billing_items, payment_records), sin dual-id de Firestore: no hay datos
// migrados para este dominio, así que el id público es directamente el uuid.
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { billingItems, paymentRecords, clients, contracts, invoices, invoiceItems } from "@/lib/db/schema";
import type { BillingItem, BillingItemDraft, PaymentMethod, PaymentRecord } from "@/types/documents";
import { computeNextDueDate, isOverdue } from "@/lib/billing/next-due";
import { computePaymentTransition } from "@/lib/billing/payment-transition";
import { requireOwner, resolveClientPgId, orderedItemIds } from "./pg";
import { buildInvoiceItemFromBillingItem } from "./invoice-mapping";
import { getNextInvoiceNumberTx } from "./invoices";
import type { Executor } from "./executor";

type BillingItemRow = typeof billingItems.$inferSelect;
type PaymentRecordRow = typeof paymentRecords.$inferSelect;

function serializePaymentRecord(row: PaymentRecordRow): PaymentRecord {
  return {
    id: row.id,
    billingItemId: row.billingItemId,
    amount: Number(row.amount),
    method: row.method,
    paidAt: row.paidAt,
    periodKey: row.periodKey,
    reference: row.reference ?? undefined,
    note: row.note ?? undefined,
    createdBy: row.createdBy ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeBillingItem(
  row: BillingItemRow,
  extra: { clientName?: string; contractTitle?: string; paymentHistory: PaymentRecord[] },
): BillingItem {
  // "vencido" es derivado, no persistido (ver next-due.ts): solo se muestra
  // cuando el período sigue pendiente/parcial y su dueDate ya pasó.
  const displayStatus =
    (row.status === "pendiente" || row.status === "parcial") && isOverdue(row.dueDate)
      ? "vencido"
      : row.status;
  return {
    id: row.id,
    clientId: row.clientId,
    clientName: extra.clientName,
    contractId: row.contractId ?? undefined,
    contractTitle: extra.contractTitle,
    proposalId: row.proposalId ?? undefined,
    projectId: row.projectId ?? undefined,
    concept: row.concept,
    amount: Number(row.amount),
    currency: row.currency,
    frequency: row.frequency,
    status: displayStatus,
    dueDate: row.dueDate,
    nextDueDate: row.nextDueDate ?? undefined,
    notes: row.notes ?? undefined,
    paymentHistory: extra.paymentHistory,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Inserta los billing items de un contrato y, por cada uno, su factura en
 * borrador (1 factura = 1 cobro, ver invoice-mapping.ts). Idempotente: si el
 * contrato ya tiene billing items (p. ej. doble click en "Confirmar"), no
 * duplica ni cobros ni facturas. Acepta un executor (`db` o un `tx`) para
 * poder correr dentro de la misma transacción que crea el contrato.
 */
export async function createBillingItemsForContract(
  executor: Executor,
  params: {
    ownerId: string;
    clientPgId: string;
    contractPgId: string;
    proposalPgId?: string | null;
    items: BillingItemDraft[];
  },
): Promise<void> {
  const existing = await executor
    .select({ id: billingItems.id })
    .from(billingItems)
    .where(eq(billingItems.contractId, params.contractPgId))
    .limit(1);
  if (existing.length > 0) return; // ya confirmado antes — no duplicar
  if (params.items.length === 0) return;

  const inserted = await executor
    .insert(billingItems)
    .values(
      params.items.map((item) => ({
        ownerId: params.ownerId,
        clientId: params.clientPgId,
        contractId: params.contractPgId,
        proposalId: params.proposalPgId ?? null,
        concept: item.concept,
        amount: String(item.amount),
        frequency: item.frequency,
        dueDate: item.dueDate,
        nextDueDate: computeNextDueDate(item.dueDate, item.frequency),
      })),
    )
    .returning({ id: billingItems.id, concept: billingItems.concept, amount: billingItems.amount, dueDate: billingItems.dueDate });

  for (const bi of inserted) {
    const invoiceItem = buildInvoiceItemFromBillingItem({ concept: bi.concept, amount: Number(bi.amount) });
    const number = await getNextInvoiceNumberTx(executor, params.ownerId);
    const [invoiceRow] = await executor
      .insert(invoices)
      .values({
        ownerId: params.ownerId,
        clientId: params.clientPgId,
        billingItemId: bi.id,
        number,
        status: "borrador",
        subtotal: String(invoiceItem.subtotal),
        ivaRate: "0.16",
        ivaAmount: String(Math.round(invoiceItem.subtotal * 0.16 * 100) / 100),
        total: String(Math.round(invoiceItem.subtotal * 1.16 * 100) / 100),
        currency: "MXN",
        issueDate: bi.dueDate,
        dueDate: bi.dueDate,
      })
      .returning({ id: invoices.id });

    const ids = orderedItemIds(1);
    await executor.insert(invoiceItems).values([
      {
        id: ids[0],
        invoiceId: invoiceRow.id,
        description: invoiceItem.description,
        qty: String(invoiceItem.qty),
        unitPrice: String(invoiceItem.unitPrice),
        subtotal: String(invoiceItem.subtotal),
      },
    ]);
  }
}

async function loadBillingItems(conds: ReturnType<typeof eq>[]): Promise<BillingItem[]> {
  const rows = await db
    .select({ item: billingItems, clientName: clients.name, contractTitle: contracts.title })
    .from(billingItems)
    .innerJoin(clients, eq(billingItems.clientId, clients.id))
    .leftJoin(contracts, eq(billingItems.contractId, contracts.id))
    .where(and(...conds))
    .orderBy(desc(billingItems.dueDate));

  if (rows.length === 0) return [];

  const paymentRows = await db
    .select()
    .from(paymentRecords)
    .where(inArray(paymentRecords.billingItemId, rows.map((r) => r.item.id)))
    .orderBy(desc(paymentRecords.paidAt));

  const byItem = new Map<string, PaymentRecord[]>();
  for (const p of paymentRows) {
    const list = byItem.get(p.billingItemId) ?? [];
    list.push(serializePaymentRecord(p));
    byItem.set(p.billingItemId, list);
  }

  return rows.map((r) =>
    serializeBillingItem(r.item, {
      clientName: r.clientName,
      contractTitle: r.contractTitle ?? undefined,
      paymentHistory: byItem.get(r.item.id) ?? [],
    }),
  );
}

/** Todos los cobros del owner — para el módulo Finanzas global (/cobros). */
export async function getBillingItems(): Promise<BillingItem[]> {
  const { ownerId } = await requireOwner();
  return loadBillingItems([eq(billingItems.ownerId, ownerId)]);
}

/** Cobros de un cliente en particular (acepta id público o uuid). */
export async function getBillingItemsForClient(clientId: string): Promise<BillingItem[]> {
  const { ownerId } = await requireOwner();
  const clientPgId = await resolveClientPgId(clientId);
  if (!clientPgId) return [];
  return loadBillingItems([eq(billingItems.ownerId, ownerId), eq(billingItems.clientId, clientPgId)]);
}

export interface RecordPaymentInput {
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  reference?: string;
  note?: string;
}

/**
 * Registra un pago sobre un billing item y aplica la transición de estado
 * (ver src/lib/billing/payment-transition.ts): pago único -> pagado sin
 * próximo cobro; recurrente completo -> avanza al siguiente período;
 * parcial -> status "parcial" conservando el período actual.
 */
export async function recordPayment(billingItemId: string, input: RecordPaymentInput): Promise<void> {
  const { ownerId } = await requireOwner();

  await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(billingItems)
      .where(and(eq(billingItems.id, billingItemId), eq(billingItems.ownerId, ownerId)))
      .limit(1);
    if (!row) throw new Error("Cobro no encontrado");
    if (row.status === "pagado" || row.status === "cancelado") {
      throw new Error("Este cobro ya no admite pagos");
    }

    const paidThisPeriod = await tx
      .select()
      .from(paymentRecords)
      .where(and(eq(paymentRecords.billingItemId, row.id), eq(paymentRecords.periodKey, row.dueDate)));
    const amountPaidSoFar = paidThisPeriod.reduce((sum, p) => sum + Number(p.amount), 0);

    const transition = computePaymentTransition(
      { frequency: row.frequency, dueDate: row.dueDate, amountDue: Number(row.amount), amountPaidSoFar },
      input.amount,
    );

    await tx.insert(paymentRecords).values({
      billingItemId: row.id,
      amount: String(input.amount),
      method: input.method,
      paidAt: input.paidAt,
      periodKey: row.dueDate,
      reference: input.reference ?? null,
      note: input.note ?? null,
      createdBy: ownerId,
    });

    await tx
      .update(billingItems)
      .set({
        status: transition.status,
        dueDate: transition.dueDate,
        nextDueDate: transition.nextDueDate,
        updatedAt: new Date(),
      })
      .where(eq(billingItems.id, row.id));
  });
}
