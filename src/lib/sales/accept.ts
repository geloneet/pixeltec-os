import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { billingItems, clients, recurringCharges, sales } from '@/lib/db/schema';
import { computeBreakdown, RECURRENCE_TOTAL_LABEL, type QuoteItem, type Recurrence } from '@/lib/quotes/money';
import { paymentSchedule, type Currency, type PaymentTerms } from '@/lib/quotes/terms';
import { nextSaleFolio, type AcceptedVia } from './model';

/**
 * Aceptar una cotización: crea la Venta, sus cobros y sus recurrentes
 * (WO-2026-00106, autorizado por ADR-0057).
 *
 * TODO ocurre en UNA transacción. La garantía de que una cotización produce
 * como máximo una venta NO está aquí: está en el índice único
 * `sales_quotation_idx` de la base. Este código se apoya en él —
 * `onConflictDoNothing` + relectura— en vez de en un «comprueba y luego
 * inserta», que con dos peticiones concurrentes dejaría pasar las dos.
 *
 * Reutiliza el modelo financiero existente: los cobros son `billing_items` y
 * los recurrentes son `recurring_charges`. No se crea ningún sistema paralelo.
 */

export interface AcceptQuoteInput {
  quoteId: string;
  clientId: string;
  title: string;
  folio: string;
  items: QuoteItem[];
  taxEnabled: boolean;
  currency: Currency;
  paymentTerms: PaymentTerms;
  /** Vigencia de la cotización; sirve de vencimiento de los cobros. */
  validUntil: string | null;
  acceptedAt: Date;
  acceptedVia: AcceptedVia;
  acceptanceNote: string;
  actorId: string | null;
}

export interface AcceptQuoteResult {
  saleId: string;
  folio: string;
  /** `true` si la venta ya existía: la segunda aceptación no duplicó nada. */
  alreadyExisted: boolean;
}

/** Centavos → `numeric(12,2)`. La división vive solo aquí. */
function toAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** `YYYY-MM-DD` para `billing_items.due_date`, que es NOT NULL. */
function toDueDate(validUntil: string | null, fallback: Date): string {
  const date = validUntil ? new Date(validUntil) : fallback;
  return (Number.isNaN(date.getTime()) ? fallback : date).toISOString().slice(0, 10);
}

/**
 * `recurring_charges.frequency` usa su propio enum, en inglés y con solo dos
 * valores (`monthly|annual`) — distinto del `billing_frequency` de los cobros.
 * La traducción vive aquí y no repartida por el código.
 */
const FREQUENCY: Record<Exclude<Recurrence, 'unica'>, 'monthly'> = { mensual: 'monthly' };

export async function acceptQuoteAndCreateSale(input: AcceptQuoteInput): Promise<AcceptQuoteResult> {
  const breakdown = computeBreakdown(input.items, input.taxEnabled);
  const dueDate = toDueDate(input.validUntil, input.acceptedAt);

  return db.transaction(async (tx) => {
    // ── 1. La Venta, una y solo una ─────────────────────────────────────────
    const [owner] = await tx
      .select({ ownerId: clients.ownerId, email: clients.email })
      .from(clients)
      .where(eq(clients.id, input.clientId))
      .limit(1);
    if (!owner) throw new Error('El cliente ya no existe.');

    const folios = await tx.select({ folio: sales.folio }).from(sales);
    const folio = nextSaleFolio(input.acceptedAt.getFullYear(), folios.map((f) => f.folio));

    const inserted = await tx
      .insert(sales)
      .values({
        folio,
        clientId: input.clientId,
        quotationId: input.quoteId,
        status: 'pendiente_anticipo',
        currency: input.currency,
        title: input.title,
        acceptedAt: input.acceptedAt,
        acceptedVia: input.acceptedVia,
        acceptanceNote: input.acceptanceNote,
        oneTimeTotalCents: breakdown.oneTime.totalCents,
        createdBy: input.actorId,
      })
      // El índice único decide. Si otra petición llegó primero, esta no crea
      // nada y se queda con la que ya existe.
      .onConflictDoNothing({ target: sales.quotationId })
      .returning({ id: sales.id, folio: sales.folio });

    if (inserted.length === 0) {
      const [existing] = await tx
        .select({ id: sales.id, folio: sales.folio })
        .from(sales)
        .where(eq(sales.quotationId, input.quoteId))
        .limit(1);
      if (!existing) throw new Error('No se pudo crear la venta.');
      return { saleId: existing.id, folio: existing.folio, alreadyExisted: true };
    }

    const sale = inserted[0];

    // ── 2. Cobros del PAGO ÚNICO ────────────────────────────────────────────
    // El reparto se aplica SOLO al pago único: un «50 % de anticipo» sobre una
    // mensualidad no significa nada. Si no hay reparto conocido (mensual o
    // personalizada), se crea un cobro por el total.
    const schedule = paymentSchedule(breakdown.oneTime.totalCents, input.paymentTerms);
    const cobros =
      schedule.length > 0
        ? schedule.map((i) => ({ concept: `${i.label} ${input.folio}`, amountCents: i.amountCents }))
        : breakdown.oneTime.totalCents > 0
          ? [{ concept: `Pago ${input.folio}`, amountCents: breakdown.oneTime.totalCents }]
          : [];

    for (const [index, cobro] of cobros.entries()) {
      if (cobro.amountCents <= 0) continue;
      await tx
        .insert(billingItems)
        .values({
          ownerId: owner.ownerId,
          clientId: input.clientId,
          saleId: sale.id,
          concept: cobro.concept,
          amount: toAmount(cobro.amountCents),
          currency: input.currency,
          frequency: 'unico',
          status: 'pendiente',
          dueDate,
          // `now()` es CONSTANTE dentro de una transacción de Postgres: sin
          // este desplazamiento los dos cobros nacen con el mismo `createdAt`
          // y el orden queda a merced del planificador — se vio marcando
          // «Contra entrega» como anticipo. Un milisegundo por parcialidad
          // conserva el orden del calendario de pagos de forma determinista.
          createdAt: new Date(input.acceptedAt.getTime() + index),
          notes: `Parcialidad ${index + 1} de ${cobros.length} · ${input.folio}`,
        })
        // Índice parcial (sale_id, concept): reintentar no duplica cobros.
        .onConflictDoNothing();
    }

    // ── 3. Recurrentes: nacen PENDIENTES DE INICIO ──────────────────────────
    // No se generan cobros mensuales futuros ni se arranca ningún cron: la
    // fecha del primer cobro la decide una persona al activarlo (§9, §10).
    for (const grupo of breakdown.recurring) {
      if (grupo.totals.totalCents <= 0) continue;
      await tx.insert(recurringCharges).values({
        saleId: sale.id,
        clientId: input.clientId,
        projectId: null,
        concept: `${RECURRENCE_TOTAL_LABEL[grupo.recurrence]} ${input.folio}`,
        amount: toAmount(grupo.totals.totalCents),
        frequency: FREQUENCY[grupo.recurrence as Exclude<Recurrence, 'unica'>],
        startDate: null,
        // NOT NULL heredado del modelo antiguo: se rellena desde el cliente.
        clientEmail: owner.email ?? '',
        status: 'pending_start',
        // El booleano heredado queda en `false` mientras no esté activo: el
        // código congelado de Finanzas lo sigue leyendo.
        active: false,
      });
    }

    return { saleId: sale.id, folio: sale.folio, alreadyExisted: false };
  });
}
