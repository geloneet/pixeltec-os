import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNotNull, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { billingItems, clients, recurringCharges, sales } from "@/lib/db/schema";
import { assertCronExecutionAllowed, cronBlockedResponse } from "@/lib/cron-guard";
import { getNextChargeDate, getMostRecentUnpaidChargeDate, planReminders } from "@/lib/crm/next-charge-date";
import { buildMaterializedBillingItem } from "@/lib/sales/recurring-scheduler";
import { sendBillingReminder } from "@/lib/billing/reminder-notify";
import { toRouteFailure } from "@/lib/errors/route-failure";

/**
 * Scheduler de `recurring_charges` originados en una Venta (Parte C/D del
 * diseño 2026-08-27). Independiente de `notifications/charges` (CRM legado,
 * itera por `firestoreId`) y de `notifications/billing-charges` (ADR-0040,
 * solo `billing_items`) — mismo patrón que esos dos: cada generación de datos
 * tiene su propio scheduler, ninguno reemplaza al otro.
 *
 * MODELO (corregido 2026-08-28 tras revisión final): un recurrente se
 * materializa en `billing_items` UNA SOLA VEZ — no una fila por período. A
 * partir de ahí, la MISMA fila avanza sola en cada pago completo
 * (`computePaymentTransition`, "recurrente completo -> avanza al siguiente
 * período") — ese mecanismo ya existe y está congelado (ADR-0057); este cron
 * nunca vuelve a insertar para un `recurring_charge_id` que ya tiene una fila
 * viva. Los avisos de checkpoint (30/15/1 anual, 2/1 mensual), una vez
 * materializado, se calculan sobre la `due_date` VIGENTE de esa fila — no
 * sobre aritmética de fechas del recurrente — para que sigan funcionando en
 * el segundo ciclo, el tercero, etc.
 *
 * Alcance: solo recurrentes con `sale_id` no nulo (nacidos de una Venta,
 * WO-2026-00106/ADR-0057) — nunca los del CRM legado (`notifications/charges`
 * ya los cubre con su propio criterio; la migración 0047 dejó recurrentes
 * legados en `status='active'` sin que este flujo los haya originado).
 */
export async function GET(req: NextRequest) {
  const provided = req.headers.get("authorization")?.replace("Bearer ", "") ?? req.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET || provided !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    assertCronExecutionAllowed();
  } catch (err) {
    const blocked = cronBlockedResponse(err);
    if (blocked) return blocked;
    throw err;
  }

  try {
    const today = new Date();
    const active = await db
      .select()
      .from(recurringCharges)
      .where(and(eq(recurringCharges.status, "active"), isNotNull(recurringCharges.saleId)));

    const results: string[] = [];

    for (const charge of active) {
      if (!charge.startDate || !charge.clientId) {
        results.push(`Recurrente ${charge.id} sin startDate/clientId — omitido`);
        continue;
      }

      const [client] = await db
        .select({ name: clients.name, email: clients.email })
        .from(clients)
        .where(eq(clients.id, charge.clientId))
        .limit(1);
      if (!client) {
        results.push(`Recurrente ${charge.id}: cliente ${charge.clientId} ya no existe — omitido`);
        continue;
      }

      // ¿Ya existe la fila que representa esta obligación recurrente? Solo
      // puede haber una viva (no cancelada) por recurrente — una vez creada,
      // `recordPayment` la hace avanzar sola en cada pago completo. Nunca se
      // inserta una segunda para el mismo `recurring_charge_id`.
      const [existing] = await db
        .select({ id: billingItems.id, dueDate: billingItems.dueDate, currency: billingItems.currency })
        .from(billingItems)
        .where(and(eq(billingItems.recurringChargeId, charge.id), ne(billingItems.status, "cancelado")))
        .limit(1);

      if (existing) {
        const dueDate = new Date(`${existing.dueDate}T00:00:00`);
        const reminderState = {
          reminderCycleDue: charge.reminderCycleDue,
          reminderCheckpointsSent: (charge.reminderCheckpointsSent as number[] | null) ?? [],
        };
        const plan = planReminders(dueDate, charge.frequency, reminderState, today);
        if (plan.checkpointsToSend.length === 0) continue;

        const { emailOk } = await sendBillingReminder({
          clientName: client.name,
          clientEmail: client.email,
          concept: charge.concept,
          amount: charge.amount,
          currency: existing.currency,
          dueDate,
          overdue: false,
        });

        if (emailOk) {
          await db
            .update(recurringCharges)
            .set({
              reminderCycleDue: plan.cycleDue,
              reminderCheckpointsSent: [
                ...(plan.isNewCycle ? [] : reminderState.reminderCheckpointsSent),
                ...plan.checkpointsToSend,
              ],
            })
            .where(eq(recurringCharges.id, charge.id));
          results.push(`Aviso ${plan.checkpointsToSend.join(",")}d enviado para ${charge.concept} (ya materializado)`);
        }
        continue;
      }

      // Sin `lastNotified`: la supresión "ya avisado para este período" de
      // `getMostRecentUnpaidChargeDate` es innecesaria aquí — la idempotencia
      // de "no materializar dos veces" la garantiza el paso anterior (ya
      // existe la fila) más el índice único parcial como red de seguridad
      // ante una carrera entre dos corridas concurrentes.
      const dueNow = getMostRecentUnpaidChargeDate(charge.startDate, charge.frequency);

      if (dueNow) {
        const [saleRow] = charge.saleId
          ? await db.select({ currency: sales.currency }).from(sales).where(eq(sales.id, charge.saleId)).limit(1)
          : [];
        const draft = buildMaterializedBillingItem(
          {
            id: charge.id,
            saleId: charge.saleId,
            clientId: charge.clientId,
            projectId: charge.projectId,
            concept: charge.concept,
            amount: charge.amount,
            frequency: charge.frequency,
          },
          dueNow,
          saleRow?.currency ?? "MXN",
        );
        const [owner] = await db.select({ ownerId: clients.ownerId }).from(clients).where(eq(clients.id, charge.clientId)).limit(1);
        if (!owner) {
          results.push(`Recurrente ${charge.id}: sin ownerId de cliente — omitido`);
          continue;
        }
        // Sin `target`: el índice único real es PARCIAL (migración 0048).
        // `.onConflictDoNothing({ target: [...] })` compila pero Postgres lo
        // rechaza en runtime (42P10) — confirmado en vivo. La forma sin
        // `target` sí funciona: aplica DO NOTHING a cualquier violación de
        // constraint, sin necesitar inferencia de árbitro.
        const inserted = await db
          .insert(billingItems)
          .values({ ...draft, ownerId: owner.ownerId })
          .onConflictDoNothing()
          .returning({ id: billingItems.id });
        if (inserted.length > 0) {
          results.push(`Cobro materializado para ${charge.concept} (${charge.id})`);
        } else {
          // onConflictDoNothing silenció una violación del índice único —
          // lo más probable es que ya exista una fila CANCELADA para este
          // mismo (recurring_charge_id, due_date): el filtro `existing` de
          // arriba excluye 'cancelado' a propósito (una fila cancelada no
          // cuenta como "ya materializado" para reanudar avisos), pero el
          // índice sí la cuenta para unicidad — el recurrente se queda sin
          // fila viva y sin aviso hasta que alguien lo note. No se reintenta
          // ni se decide el comportamiento aquí (Finanzas, ADR-0057): se
          // reporta para que un humano lo revise.
          results.push(`ANOMALÍA: recurrente ${charge.id} (${charge.concept}) no se pudo materializar para ${dueNow.toISOString().slice(0, 10)} — probable fila cancelada ocupando el mismo período; revisar manualmente`);
        }
        continue; // primera materialización: de aquí en más, recordPayment avanza esta misma fila
      }

      // Aún no vence el primer período — evaluar avisos de checkpoint contra
      // la próxima fecha (aritmética del recurrente: todavía no hay fila real).
      const dueDate = getNextChargeDate(charge.startDate, charge.frequency);
      const [saleRowForCurrency] = charge.saleId
        ? await db.select({ currency: sales.currency }).from(sales).where(eq(sales.id, charge.saleId)).limit(1)
        : [];

      const reminderState = {
        reminderCycleDue: charge.reminderCycleDue,
        reminderCheckpointsSent: (charge.reminderCheckpointsSent as number[] | null) ?? [],
      };
      const plan = planReminders(dueDate, charge.frequency, reminderState, today);
      if (plan.checkpointsToSend.length === 0) continue;

      const { emailOk } = await sendBillingReminder({
        clientName: client.name,
        clientEmail: client.email,
        concept: charge.concept,
        amount: charge.amount,
        currency: saleRowForCurrency?.currency ?? "MXN",
        dueDate,
        overdue: false,
      });

      if (emailOk) {
        await db
          .update(recurringCharges)
          .set({
            reminderCycleDue: plan.cycleDue,
            reminderCheckpointsSent: [
              ...(plan.isNewCycle ? [] : reminderState.reminderCheckpointsSent),
              ...plan.checkpointsToSend,
            ],
          })
          .where(eq(recurringCharges.id, charge.id));
        results.push(`Aviso ${plan.checkpointsToSend.join(",")}d enviado para ${charge.concept}`);
      }
    }

    return NextResponse.json({ success: true, notificationsSent: results.length, details: results });
  } catch (error: unknown) {
    console.error("[recurring-charges-cron] error:", error);
    const failure = toRouteFailure(error, {
      code: "recurring_charges_cron_failed",
      message: "No se pudo procesar el cron de recurrentes.",
      status: 500,
    });
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status });
  }
}
