import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
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
 * Por cada recurrente `active`: si su período vigente ya venció, materializa
 * un `billing_item` real (idempotente vía el índice único
 * `(recurring_charge_id, due_date)`); si no, evalúa si toca mandar un aviso
 * (30/15 días antes para anual, 2/1 para mensual).
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
    const active = await db.select().from(recurringCharges).where(eq(recurringCharges.status, "active"));

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

      // Sin `lastNotified`: la supresión "ya avisado para este período" de
      // `getMostRecentUnpaidChargeDate` es innecesaria aquí — la idempotencia
      // de la materialización viene del índice único parcial de `billing_items`
      // (`recurring_charge_id` + `due_date`) vía `.onConflictDoNothing()`, no
      // de este proxy basado en `lastNotified` (pensado para otro consumidor).
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
        // Sin `target`: el índice único real (`billing_items_recurring_charge_due_idx`)
        // es PARCIAL (`WHERE recurring_charge_id IS NOT NULL`, migración 0048).
        // `.onConflictDoNothing({ target: [...] })` compila sin error de tipos
        // (drizzle no valida el predicado parcial en tiempo de compilación),
        // pero en runtime Postgres lo rechaza: "there is no unique or exclusion
        // constraint matching the ON CONFLICT specification" (42P10) — el
        // target inferido no incluye el WHERE del índice parcial. Confirmado
        // en vivo contra la base de dev. La forma sin `target` sí funciona:
        // Postgres aplica el DO NOTHING a cualquier violación de constraint,
        // sin necesitar inferencia de árbitro.
        const inserted = await db
          .insert(billingItems)
          .values({ ...draft, ownerId: owner.ownerId })
          .onConflictDoNothing()
          .returning({ id: billingItems.id });
        if (inserted.length > 0) {
          results.push(`Cobro materializado para ${charge.concept} (${charge.id})`);
        }
        continue; // vencido: ya no manda avisos "antes" — eso terminó
      }

      // No vencido todavía — evaluar avisos de checkpoint contra la próxima fecha.
      const dueDate = getNextChargeDate(charge.startDate, charge.frequency);

      // `reminder_checkpoints_sent` es jsonb (tipo `unknown` para drizzle, mismo
      // criterio que el resto de columnas jsonb de este schema — sin
      // `.$type<>()`, se castea al leer, no en la definición de la columna).
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
        currency: "MXN",
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
