import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { billingItems, clients } from '@/lib/db/schema';

/**
 * Puente Cotización → Cobro (WO-2026-00104 §22).
 *
 * ARCHIVO NUEVO A PROPÓSITO. Finanzas es zona congelada: el criterio 7 de
 * WO-2026-00088 exige `diff en src/app/(admin)/cobros/** y lógica financiera =
 * 0 archivos`. Aquí no se modifica nada de Finanzas — se INSERTA una fila en
 * `billing_items`, que es lo mismo que ya hace `createBillingItemsForContract`
 * desde el flujo de contratos. La pantalla de Cobros lo muestra porque lee esa
 * tabla, no porque se haya tocado.
 *
 * Lo que NO hace (§22 y §31): no crea proyectos, ni tareas, ni contratos, ni
 * toca PIXELDASH. El CRM termina su responsabilidad comercial en venta + cobro.
 */

export interface CreateChargeInput {
  clientId: string;
  /** Texto del cobro, p. ej. «Anticipo COT-2026-0013». */
  concept: string;
  /** Importe en CENTAVOS: se convierte a `numeric(12,2)` aquí, en un solo sitio. */
  amountCents: number;
  currency: string;
  /**
   * Vencimiento, en `YYYY-MM-DD`. `billing_items.due_date` es NOT NULL, así
   * que quien llama debe decidirlo: se usa la vigencia de la cotización y, si
   * no la tiene, hoy.
   */
  dueDate: string;
  /**
   * Periodicidad del cobro. Coincide con el enum `billing_frequency` que ya
   * existía: un concepto mensual de la cotización nace como cobro mensual.
   */
  frequency: 'unico' | 'mensual' | 'trimestral' | 'anual';
}

/**
 * La cotización dice «unica»; el enum de Finanzas dice «unico». La traducción
 * vive aquí, en la frontera, y no repartida por las acciones.
 */
export function toBillingFrequency(recurrence: string): CreateChargeInput['frequency'] {
  switch (recurrence) {
    case 'mensual':
    case 'trimestral':
    case 'anual':
      return recurrence;
    default:
      return 'unico';
  }
}

/**
 * Crea el cobro. `ownerId` sale del dueño del cliente para no inventar una
 * pertenencia distinta de la que ya tiene el resto de Finanzas.
 */
export async function createChargeFromQuote(input: CreateChargeInput): Promise<{ id: string } | null> {
  const owner = await db
    .select({ ownerId: clients.ownerId })
    .from(clients)
    .where(eq(clients.id, input.clientId))
    .limit(1);
  const ownerId = owner[0]?.ownerId;
  if (!ownerId) return null;

  const rows = await db
    .insert(billingItems)
    .values({
      ownerId,
      clientId: input.clientId,
      concept: input.concept,
      // Centavos → decimal con dos posiciones. La división vive SOLO aquí.
      amount: (input.amountCents / 100).toFixed(2),
      currency: input.currency,
      frequency: input.frequency,
      status: 'pendiente',
      dueDate: input.dueDate,
    })
    .returning({ id: billingItems.id });

  return rows[0] ?? null;
}
