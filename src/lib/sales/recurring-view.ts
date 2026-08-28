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

  // `recurringCharges.clientId` es nullable en el schema; el innerJoin de
  // arriba (`clients.id = recurringCharges.clientId`) ya garantiza que
  // ninguna fila devuelta aquí tiene clientId nulo (una comparación SQL
  // contra NULL nunca es verdadera, así que esas filas quedan fuera del
  // join) — pero en vez de confiar en esa garantía con un `!`, el type
  // predicate de abajo la vuelve explícita y a prueba de fallos: si algún
  // día el join cambia y sí llega null, la fila simplemente se filtra en
  // vez de propagar un `null` mal tipado como `string`.
  return rows
    .filter((r): r is typeof r & { clientId: string; startDate: string } => r.clientId !== null && r.startDate !== null)
    .map((r) => ({
      id: r.id,
      clientId: r.clientId,
      clientName: r.clientName,
      concept: r.concept,
      amount: r.amount,
      frequency: r.frequency as 'monthly' | 'annual',
      nextChargeDate: getNextChargeDate(r.startDate, r.frequency as 'monthly' | 'annual').toISOString().slice(0, 10),
    }));
}
