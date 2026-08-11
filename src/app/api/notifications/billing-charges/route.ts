import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { billingItems, clients } from "@/lib/db/schema";
import { assertCronExecutionAllowed, cronBlockedResponse } from "@/lib/cron-guard";
import { sendEmail } from "@/lib/email";
import { sendWhatsApp } from "@/lib/whatsapp/sender";
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
      const dateStr = new Date(`${item.dueDate}T00:00:00`).toLocaleDateString("es-MX", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const amountStr = new Intl.NumberFormat("es-MX", { style: "currency", currency: item.currency }).format(
        Number(item.amount),
      );

      let emailOk = true;
      if (client.email) {
        const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f4f5;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
    <div style="background:#000;padding:28px 32px;"><p style="margin:0;font-size:20px;font-weight:700;color:#fff;">Pixel<span style="color:#06b6d4;">TEC</span></p></div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 12px;font-size:18px;color:#09090b;">${overdue ? "Cobro vencido" : "Cobro próximo"}</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#52525b;">
        Hola ${client.name}, ${overdue ? "el siguiente cobro venció el" : "el siguiente cobro vence el"}
        <strong>${dateStr}</strong>: <strong>${item.concept}</strong> — ${amountStr}.
      </p>
      <p style="margin:0;font-size:12px;color:#a1a1aa;">PixelTEC — pixeltec.mx</p>
    </div>
  </div>
</body></html>`;
        try {
          const result = await sendEmail(client.email, `${overdue ? "Cobro vencido" : "Recordatorio de cobro"} — ${item.concept}`, html);
          emailOk = result.success;
          notifications.push(emailOk ? `Email sent to ${client.email}` : `Email FAILED: ${result.error}`);
        } catch (e) {
          emailOk = false;
          console.error("[billing-charges] email send threw:", e instanceof Error ? e.name : typeof e);
        }
      }

      try {
        await sendWhatsApp(
          `*${overdue ? "Cobro vencido" : "Cobro próximo"} — ${client.name}*\n\n` +
            `*Concepto:* ${item.concept}\n*Monto:* ${amountStr}\n*Fecha:* ${dateStr}\n\npixeltec.mx/cobros`,
        );
        notifications.push(`WhatsApp sent for ${item.concept}`);
      } catch (e) {
        console.error("[billing-charges] whatsapp send failed:", e instanceof Error ? e.name : typeof e);
      }

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
