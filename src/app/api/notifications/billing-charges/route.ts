import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { billingItems, clients } from "@/lib/db/schema";
import { assertCronExecutionAllowed, cronBlockedResponse } from "@/lib/cron-guard";
import { sendBillingReminder } from "@/lib/billing/reminder-notify";
import { isOverdue } from "@/lib/billing/next-due";
import { toRouteFailure } from "@/lib/errors/route-failure";

/**
 * C6 (ADR-0040) — scheduler real de `billing_items`. El cron legado en
 * `notifications/charges/route.ts` itera `recurring_charges` (CRM legacy) y
 * no conoce nada de lo que pasa por Contrato→Cobro (ver [[PixelTEC OS]] en
 * NeuroPIXEL, sección Ola 0/Ola 1) — este endpoint es independiente, no lo
 * reemplaza.
 *
 * Avisa cuando un `billing_item` vencido o vence en ≤3 días, una vez por
 * `dueDate` (idempotencia vía `remindedForDueDate`, mismo patrón que
 * `recurringCharges.lastNotified`).
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
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + 3);
    const horizonKey = horizon.toISOString().slice(0, 10);

    const candidates = await db
      .select({
        id: billingItems.id,
        clientId: billingItems.clientId,
        concept: billingItems.concept,
        amount: billingItems.amount,
        currency: billingItems.currency,
        dueDate: billingItems.dueDate,
        remindedForDueDate: billingItems.remindedForDueDate,
      })
      .from(billingItems)
      .where(and(inArray(billingItems.status, ["pendiente", "parcial"]), lte(billingItems.dueDate, horizonKey)));

    const notifications: string[] = [];

    for (const item of candidates) {
      if (item.remindedForDueDate === item.dueDate) continue; // ya avisado este período

      const [client] = await db
        .select({ name: clients.name, email: clients.email })
        .from(clients)
        .where(eq(clients.id, item.clientId))
        .limit(1);
      if (!client) continue;

      const overdue = isOverdue(item.dueDate, today);

      const { emailOk } = await sendBillingReminder({
        clientName: client.name,
        clientEmail: client.email,
        concept: item.concept,
        amount: item.amount,
        currency: item.currency,
        dueDate: new Date(`${item.dueDate}T00:00:00`),
        overdue,
      });
      notifications.push(emailOk ? `Reminder sent for ${item.concept}` : `Reminder email FAILED for ${item.concept}`);

      if (emailOk) {
        await db.update(billingItems).set({ remindedForDueDate: item.dueDate }).where(eq(billingItems.id, item.id));
      }
    }

    return NextResponse.json({ success: true, notificationsSent: notifications.length, details: notifications });
  } catch (error: unknown) {
    console.error("[billing-charges] error:", error);
    const failure = toRouteFailure(error, {
      code: "billing_charges_notification_failed",
      message: "No se pudieron procesar los recordatorios de cobros.",
      status: 500,
    });
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status });
  }
}
