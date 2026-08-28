/**
 * Scheduler de recurrentes (Parte C del diseño, 2026-08-27): decide cuándo un
 * recurrente ACTIVO ya venció y qué `billing_item` real hay que crear para
 * ese período. Módulo puro — el cron (`api/cron/recurring-charges`) es quien
 * toca `db` y llama a estas funciones.
 *
 * Esta pieza es la que ADR-0057/WO-2026-00106 §10 dejó explícitamente fuera
 * ("no existe scheduler... ADR-0057 dejó fuera construir uno") — sin ella,
 * un recurrente vencido no tenía ningún cobro real que se pudiera pagar.
 */
import { differenceInCalendarDays } from 'date-fns';

/** `true` si el período vigente ya debió cobrarse (hoy o antes). */
export function isChargeDue(dueDate: Date, today: Date): boolean {
  return differenceInCalendarDays(dueDate, today) <= 0;
}

export interface RecurringChargeForScheduling {
  id: string;
  saleId: string | null;
  clientId: string | null;
  projectId: string | null;
  concept: string;
  amount: string;
  frequency: 'monthly' | 'annual';
}

export interface BillingItemDraft {
  clientId: string;
  saleId: string | null;
  projectId: string | null;
  recurringChargeId: string;
  concept: string;
  amount: string;
  currency: string;
  frequency: 'mensual' | 'anual';
  status: 'pendiente';
  dueDate: string;
}

const CHARGE_TO_BILLING_FREQUENCY: Record<'monthly' | 'annual', 'mensual' | 'anual'> = {
  monthly: 'mensual',
  annual: 'anual',
};

/** El `billing_item` real que hay que crear cuando un recurrente vence. */
export function buildMaterializedBillingItem(
  charge: RecurringChargeForScheduling,
  dueDate: Date,
  currency: string,
): BillingItemDraft {
  if (!charge.clientId) throw new Error(`Recurrente ${charge.id} sin clientId — no se puede materializar.`);
  return {
    clientId: charge.clientId,
    saleId: charge.saleId,
    projectId: charge.projectId,
    recurringChargeId: charge.id,
    concept: charge.concept,
    amount: charge.amount,
    currency,
    frequency: CHARGE_TO_BILLING_FREQUENCY[charge.frequency],
    status: 'pendiente',
    dueDate: dueDate.toISOString().slice(0, 10),
  };
}
