/**
 * Aprovisionamiento automático al volverse la Venta cobrable (Parte A/B del
 * diseño 2026-08-27). Este módulo es PURO — sin `db`, sin `next` — para que
 * las reglas de negocio (qué se crea, con qué datos) se prueben sin tocar la
 * base. La transacción que sí toca `db` vive en `provisionProjectAndRecurrents`
 * más abajo, sin test unitario — mismo criterio que `acceptQuoteAndCreateSale`
 * en `sales/accept.ts`, que tampoco lo tiene.
 */
import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { billingItems, projects, recurringCharges, sales } from '@/lib/db/schema';

export interface ProjectDraft {
  clientId: string;
  name: string;
  budget: string;
  annual: string;
}

/** Centavos → `numeric(12,2)` como string — mismo criterio que `toAmount` en `accept.ts`. */
export function centsToAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

export interface RecurringForDraft {
  frequency: 'monthly' | 'annual';
  amount: string;
}

/** Qué proyecto crear a partir de una Venta ya cobrable — función pura. */
export function buildProjectDraft(
  sale: { clientId: string; title: string; oneTimeTotalCents: number },
  recurring: readonly RecurringForDraft[],
): ProjectDraft {
  const annualCharge = recurring.find((r) => r.frequency === 'annual');
  return {
    clientId: sale.clientId,
    name: sale.title,
    budget: centsToAmount(sale.oneTimeTotalCents),
    annual: annualCharge ? annualCharge.amount : '0.00',
  };
}

/**
 * `YYYY-MM-DD` en hora LOCAL — mismo criterio que `firstAnniversary()`
 * (`sales/model.ts`): un recurrente mensual arranca el día calendario en que
 * se registró el pago, no el día UTC.
 */
export function monthlyStartDate(now: Date): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export interface ProvisionResult {
  projectId: string;
}

/**
 * Crea el proyecto y activa los recurrentes de una Venta que ACABA de
 * volverse cobrable. Idempotente por `sales.project_id` (índice único): si ya
 * existe, no hace nada y regresa ese id — puede llamarse más de una vez sin
 * duplicar nada.
 */
export async function provisionProjectAndRecurrents(saleId: string, now: Date = new Date()): Promise<ProvisionResult> {
  return db.transaction(async (tx) => {
    const [saleRow] = await tx.select().from(sales).where(eq(sales.id, saleId)).limit(1).for('update');
    if (!saleRow) throw new Error('La venta ya no existe.');
    if (saleRow.projectId) return { projectId: saleRow.projectId };

    const recurringRows = await tx.select().from(recurringCharges).where(eq(recurringCharges.saleId, saleId));

    const draft = buildProjectDraft(saleRow, recurringRows);
    const [project] = await tx.insert(projects).values(draft).returning({ id: projects.id });

    await tx.update(sales).set({ projectId: project.id, updatedAt: new Date() }).where(eq(sales.id, saleId));
    await tx.update(billingItems).set({ projectId: project.id }).where(eq(billingItems.saleId, saleId));

    const monthlyStart = monthlyStartDate(now);
    for (const r of recurringRows) {
      await tx
        .update(recurringCharges)
        .set({
          projectId: project.id,
          status: 'active',
          active: true,
          startDate: r.frequency === 'monthly' ? monthlyStart : r.startDate,
        })
        .where(eq(recurringCharges.id, r.id));
    }

    return { projectId: project.id };
  });
}
