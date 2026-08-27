'use server';

/**
 * Server Actions de la Venta (WO-2026-00106, autorizado por ADR-0057).
 *
 * Lo que estas acciones NO hacen: no registran pagos. Eso ya existe y funciona
 * (`recordPayment` + `RecordPaymentDialog`), y ADR-0057 prohíbe expresamente
 * refactorizarlo. Aquí solo se reconcilia el estado de la Venta DESPUÉS de que
 * el sistema financiero haya hecho su trabajo.
 */
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { recurringCharges, sales } from '@/lib/db/schema';
import { requireAdmin } from '@/lib/auth-guards';
import { toPublicFailure } from '@/lib/errors/public-failure';
import type { ActionResult } from '@/lib/blog/schemas';
import { RECURRING_STATUSES } from './model';
import { getSaleById, getSaleByQuotation, type SaleRecord } from './queries';

function fail(err: unknown, code: string, message: string): ActionResult<never> {
  const detail =
    err instanceof z.ZodError
      ? err.issues.map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`).join(' · ')
      : err instanceof Error
        ? err.name
        : typeof err;
  console.error(`[sales] ${code}:`, detail);
  return { ok: false, error: toPublicFailure(err, { code, message }).message };
}

/** Lee la venta y, si el estado guardado quedó atrás, lo pone al día. */
async function syncStatus(sale: SaleRecord): Promise<SaleRecord> {
  if (sale.status === sale.storedStatus) return sale;
  await db.update(sales).set({ status: sale.status, updatedAt: new Date() }).where(eq(sales.id, sale.id));
  return { ...sale, storedStatus: sale.status };
}

/** La venta de una cotización, con su estado ya reconciliado. */
export async function getSaleForQuoteAction(quotationId: string): Promise<ActionResult<{ sale: unknown | null }>> {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return { ok: false, error: 'Requiere rol administrador.' };

    const sale = await getSaleByQuotation(quotationId);
    return { ok: true, data: { sale: sale ? await syncStatus(sale) : null } };
  } catch (err) {
    return fail(err, 'get_sale_failed', 'No se pudo cargar la venta.');
  }
}

export async function getSaleAction(saleId: string): Promise<ActionResult<{ sale: unknown }>> {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return { ok: false, error: 'Requiere rol administrador.' };

    const sale = await getSaleById(saleId);
    if (!sale) return { ok: false, error: 'La venta ya no existe.' };
    return { ok: true, data: { sale: await syncStatus(sale) } };
  } catch (err) {
    return fail(err, 'get_sale_failed', 'No se pudo cargar la venta.');
  }
}

const ActivateSchema = z.object({
  recurringId: z.string().uuid(),
  /** `YYYY-MM-DD` — la fecha del PRIMER cobro, que decide una persona. */
  firstChargeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido.'),
});

/**
 * Activar un recurrente (§11): lo único que pide es la fecha del primer cobro.
 *
 * NO genera el `billing_item` del primer periodo: no existe scheduler en el
 * repositorio y ADR-0057 dejó fuera construir uno. El modelo queda listo y esa
 * deuda está declarada en la ADR.
 */
export async function activateRecurring(input: z.infer<typeof ActivateSchema>): Promise<ActionResult> {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return { ok: false, error: 'Requiere rol administrador.' };

    const data = ActivateSchema.parse(input);
    const [row] = await db
      .select({ id: recurringCharges.id, status: recurringCharges.status })
      .from(recurringCharges)
      .where(eq(recurringCharges.id, data.recurringId))
      .limit(1);
    if (!row) return { ok: false, error: 'El servicio recurrente ya no existe.' };
    if (row.status === 'active') return { ok: true };

    await db
      .update(recurringCharges)
      .set({
        status: 'active',
        startDate: data.firstChargeDate,
        // El booleano heredado se mantiene alineado: lo lee código congelado
        // de Finanzas. Es derivado, no una segunda verdad.
        active: true,
      })
      .where(eq(recurringCharges.id, data.recurringId));

    revalidatePath('/clientes');
    revalidatePath('/cobros');
    return { ok: true };
  } catch (err) {
    return fail(err, 'activate_recurring_failed', 'No se pudo activar el servicio.');
  }
}

const SetRecurringStatusSchema = z.object({
  recurringId: z.string().uuid(),
  status: z.enum(RECURRING_STATUSES),
});

/** Pausar o cancelar un recurrente. Un proyecto que termina NO lo cancela (§15). */
export async function setRecurringStatus(input: z.infer<typeof SetRecurringStatusSchema>): Promise<ActionResult> {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return { ok: false, error: 'Requiere rol administrador.' };

    const data = SetRecurringStatusSchema.parse(input);
    await db
      .update(recurringCharges)
      .set({ status: data.status, active: data.status === 'active' })
      .where(eq(recurringCharges.id, data.recurringId));

    revalidatePath('/clientes');
    revalidatePath('/cobros');
    return { ok: true };
  } catch (err) {
    return fail(err, 'set_recurring_status_failed', 'No se pudo cambiar el estado.');
  }
}
