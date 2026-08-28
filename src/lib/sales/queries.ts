import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { billingItems, clients, quotes, recurringCharges, sales } from '@/lib/db/schema';
import { deriveSaleStatus, isSaleStatus, isRecurringStatus, type SaleStatus, type RecurringStatus } from './model';

/**
 * Lecturas de la Venta (WO-2026-00106).
 *
 * El estado que se muestra NO es el guardado a secas: se deriva del estado real
 * de los cobros. Así no puede desincronizarse si alguien registra un pago desde
 * Finanzas sin pasar por aquí.
 */

export interface SaleCharge {
  id: string;
  concept: string;
  amount: string;
  currency: string;
  status: string;
  dueDate: string;
  isDeposit: boolean;
}

export interface SaleRecurring {
  id: string;
  concept: string;
  amount: string;
  frequency: string;
  status: RecurringStatus;
  startDate: string | null;
}

export interface SaleRecord {
  id: string;
  /** Proyecto ya creado para esta venta, o `null` si aún no se aprovisiona. */
  projectId: string | null;
  folio: string;
  clientId: string;
  clientName: string;
  quotationId: string;
  quoteFolio: string | null;
  /** Estado derivado de los cobros — el que se muestra. */
  status: SaleStatus;
  /** Estado tal cual está en la tabla, por si hay que reconciliar. */
  storedStatus: SaleStatus;
  currency: string;
  title: string;
  acceptedAt: string;
  acceptedVia: string;
  acceptanceNote: string;
  oneTimeTotalCents: number;
  charges: SaleCharge[];
  recurring: SaleRecurring[];
}

/** El anticipo es el primer cobro por vencimiento; en empate, el más antiguo. */
function markDeposit(rows: Omit<SaleCharge, 'isDeposit'>[]): SaleCharge[] {
  const vivos = rows.filter((r) => r.status !== 'cancelado');
  const first = vivos[0]?.id;
  return rows.map((r) => ({ ...r, isDeposit: r.id === first }));
}

export async function getSaleByQuotation(quotationId: string): Promise<SaleRecord | null> {
  const [row] = await db.select().from(sales).where(eq(sales.quotationId, quotationId)).limit(1);
  return row ? hydrate(row.id) : null;
}

export async function getSaleById(id: string): Promise<SaleRecord | null> {
  return hydrate(id);
}

async function hydrate(saleId: string): Promise<SaleRecord | null> {
  const [row] = await db
    .select({ sale: sales, clientName: clients.name, quoteFolio: quotes.folio })
    .from(sales)
    .innerJoin(clients, eq(clients.id, sales.clientId))
    .leftJoin(quotes, eq(quotes.id, sales.quotationId))
    .where(eq(sales.id, saleId))
    .limit(1);
  if (!row) return null;

  const chargeRows = await db
    .select({
      id: billingItems.id,
      concept: billingItems.concept,
      amount: billingItems.amount,
      currency: billingItems.currency,
      status: billingItems.status,
      dueDate: billingItems.dueDate,
    })
    .from(billingItems)
    .where(eq(billingItems.saleId, saleId))
    .orderBy(billingItems.dueDate, billingItems.createdAt);

  const recurringRows = await db
    .select({
      id: recurringCharges.id,
      concept: recurringCharges.concept,
      amount: recurringCharges.amount,
      frequency: recurringCharges.frequency,
      status: recurringCharges.status,
      startDate: recurringCharges.startDate,
    })
    .from(recurringCharges)
    .where(eq(recurringCharges.saleId, saleId))
    .orderBy(desc(recurringCharges.createdAt));

  const charges = markDeposit(chargeRows);
  const stored: SaleStatus = isSaleStatus(row.sale.status) ? row.sale.status : 'pendiente_anticipo';

  return {
    id: row.sale.id,
    projectId: row.sale.projectId,
    folio: row.sale.folio,
    clientId: row.sale.clientId,
    clientName: row.clientName,
    quotationId: row.sale.quotationId,
    quoteFolio: row.quoteFolio ?? null,
    status: deriveSaleStatus(stored, charges),
    storedStatus: stored,
    currency: row.sale.currency,
    title: row.sale.title,
    acceptedAt: row.sale.acceptedAt.toISOString(),
    acceptedVia: row.sale.acceptedVia,
    acceptanceNote: row.sale.acceptanceNote,
    oneTimeTotalCents: row.sale.oneTimeTotalCents,
    charges,
    recurring: recurringRows.map((r) => ({
      id: r.id,
      concept: r.concept,
      amount: r.amount,
      frequency: r.frequency,
      status: isRecurringStatus(r.status) ? r.status : 'pending_start',
      startDate: r.startDate ?? null,
    })),
  };
}
