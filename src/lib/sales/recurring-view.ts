import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clients, recurringCharges } from '@/lib/db/schema';
import { getNextChargeDate } from '@/lib/crm/next-charge-date';

export interface RecurringChargeRow {
  id: string;
  clientId: string;
  clientName: string;
  concept: string;
  amount: string;
  frequency: 'monthly' | 'annual';
  nextChargeDate: string;
}

/** Recurrentes ACTIVOS, con su próximo cobro ya calculado (§Parte E/F/G). */
export async function listActiveRecurringCharges(clientId?: string): Promise<RecurringChargeRow[]> {
  const where = clientId
    ? and(eq(recurringCharges.status, 'active'), eq(recurringCharges.clientId, clientId))
    : eq(recurringCharges.status, 'active');

  const rows = await db
    .select({
      id: recurringCharges.id,
      clientId: recurringCharges.clientId,
      clientName: clients.name,
      concept: recurringCharges.concept,
      amount: recurringCharges.amount,
      frequency: recurringCharges.frequency,
      startDate: recurringCharges.startDate,
    })
    .from(recurringCharges)
    .innerJoin(clients, eq(clients.id, recurringCharges.clientId))
    .where(where);

  return rows
    .filter((r) => r.startDate)
    .map((r) => ({
      id: r.id,
      // `recurringCharges.clientId` es nullable en el schema, pero el
      // innerJoin de arriba (`clients.id = recurringCharges.clientId`)
      // garantiza que cualquier fila devuelta aquí tiene clientId no-nulo
      // (una comparación SQL contra NULL nunca es verdadera, así que esas
      // filas quedan fuera del join). No es una desviación del brief: es
      // el tipo real de la columna vs. la garantía del propio JOIN.
      clientId: r.clientId!,
      clientName: r.clientName,
      concept: r.concept,
      amount: r.amount,
      frequency: r.frequency as 'monthly' | 'annual',
      nextChargeDate: getNextChargeDate(r.startDate!, r.frequency as 'monthly' | 'annual').toISOString().slice(0, 10),
    }));
}
