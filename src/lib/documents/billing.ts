'use server';

// Cobros — puente Contrato → Cobro → Pago → Próximo cobro. Tablas nuevas
// (billing_items, payment_records), sin dual-id de Firestore: no hay datos
// migrados para este dominio, así que el id público es directamente el uuid.
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, type DB } from "@/lib/db";
import { billingItems, paymentRecords, clients, contracts } from "@/lib/db/schema";
import type { BillingItem, BillingItemDraft, PaymentMethod, PaymentRecord } from "@/types/documents";
import { computeNextDueDate, isOverdue, type BillingFrequency } from "@/lib/billing/next-due";
import { computePaymentTransition, type BillingStatus } from "@/lib/billing/payment-transition";
import { requireOwner, resolveClientPgId } from "./pg";

type BillingItemRow = typeof billingItems.$inferSelect;
type PaymentRecordRow = typeof paymentRecords.$inferSelect;

/** Cualquier ejecutor de queries Drizzle — `db` o el `tx` de una transacción. */
type Executor = DB | Parameters<Parameters<DB["transaction"]>[0]>[0];

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
 * Inserta los billing items de un contrato. Idempotente: si el contrato ya
 * tiene billing items (p. ej. doble click en "Confirmar"), no duplica.
 * Acepta un executor (`db` o un `tx`) para poder correr dentro de la misma
 * transacción que crea el contrato.
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

  await executor.insert(billingItems).values(
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
  );
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

export interface RecordPaymentResult {
  /** Qué le pasó al item — para que la UI pueda decirlo con palabras. */
  fullyPaid: boolean;
  frequency: BillingFrequency;
  /** Vencimiento del período al que se aplicó este pago. */
  coveredPeriodDue: string;
  /** Estado y vencimiento del item DESPUÉS del pago (un recurrente pagado
   * completo regresa a "pendiente" con dueDate del siguiente período — sin
   * este dato la UI parece que "no registró nada"). */
  newStatus: BillingStatus;
  newDueDate: string;
  /** Solo para pagos parciales: lo que resta del período. */
  remaining: number;
}

/**
 * Registra un pago sobre un billing item y aplica la transición de estado
 * (ver src/lib/billing/payment-transition.ts): pago único -> pagado sin
 * próximo cobro; recurrente completo -> avanza al siguiente período;
 * parcial -> status "parcial" conservando el período actual.
 */
export async function recordPayment(billingItemId: string, input: RecordPaymentInput): Promise<RecordPaymentResult> {
  const { ownerId } = await requireOwner();

  return db.transaction(async (tx) => {
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

    return {
      fullyPaid: transition.fullyPaid,
      frequency: row.frequency,
      coveredPeriodDue: row.dueDate,
      newStatus: transition.status,
      newDueDate: transition.dueDate,
      remaining: transition.fullyPaid ? 0 : Number(row.amount) - amountPaidSoFar - input.amount,
    };
  });
}
