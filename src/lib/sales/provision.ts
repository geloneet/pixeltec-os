/**
 * Aprovisionamiento automático al volverse la Venta cobrable (Parte A/B del
 * diseño 2026-08-27). Este módulo es PURO — sin `db`, sin `next` — para que
 * las reglas de negocio (qué se crea, con qué datos) se prueben sin tocar la
 * base. La transacción que sí toca `db` vive en `provisionProjectAndRecurrents`
 * más abajo, sin test unitario — mismo criterio que `acceptQuoteAndCreateSale`
 * en `sales/accept.ts`, que tampoco lo tiene.
 */
import 'server-only';

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
