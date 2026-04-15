import { NextRequest, NextResponse } from "next/server";
import { sendWhatsApp } from "@/lib/twilio";
import { sendEmail } from "@/lib/email";
import { getAdminApp } from "@/lib/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

function getNextChargeDate(startDate: string, frequency: string): Date {
  const start = new Date(startDate);
  const now = new Date();
  const next = new Date(start);
  if (frequency === "monthly") {
    while (next <= now) next.setMonth(next.getMonth() + 1);
  } else {
    while (next <= now) next.setFullYear(next.getFullYear() + 1);
  }
  return next;
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getFirestore(getAdminApp());
    const snapshot = await db.collection("crm_data").get();
    const notifications: string[] = [];
    const today = new Date();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const clients = data.clients || [];
      let updated = false;

      for (const client of clients) {
        for (const project of client.projects || []) {
          for (const charge of project.charges || []) {
            if (!charge.active) continue;

            const nextDate = getNextChargeDate(charge.startDate, charge.frequency);
            const daysUntil = Math.ceil(
              (nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            );

            const notifKey = nextDate.toISOString().split("T")[0];
            if (charge.lastNotified === notifKey) continue;

            let shouldNotify = false;

            if (charge.frequency === "annual" && daysUntil <= 30 && daysUntil > 0) {
              shouldNotify = true;
            }

            if (charge.frequency === "monthly" && daysUntil <= 1 && daysUntil > 0) {
              shouldNotify = true;
            }

            if (!shouldNotify) continue;

            const dateStr = nextDate.toLocaleDateString("es-MX", {
              day: "numeric",
              month: "long",
              year: "numeric",
            });

            // 1. Email al cliente
            if (charge.clientEmail) {
              try {
                const html = `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; border: 1px solid #e4e4e7;">
                    <div style="background: #000; padding: 28px 32px;">
                      <p style="margin: 0; font-size: 20px; font-weight: 700; color: #fff;">Pixel<span style="color: #06b6d4;">TEC</span></p>
                    </div>
                    <div style="padding: 32px;">
                      <h2 style="margin: 0 0 16px; font-size: 18px; color: #09090b;">Aviso de cobro</h2>
                      <p style="margin: 0 0 16px; font-size: 14px; color: #52525b;">
                        Estimado/a <strong>${client.name}</strong>, le informamos que el siguiente servicio tiene un cobro proximo:
                      </p>
                      <div style="background: #f4f4f5; border-radius: 12px; padding: 20px; margin: 16px 0;">
                        <p style="margin: 0 0 8px; font-size: 14px; color: #09090b;"><strong>Concepto:</strong> ${charge.concept}</p>
                        <p style="margin: 0 0 8px; font-size: 14px; color: #09090b;"><strong>Proyecto:</strong> ${project.name}</p>
                        <p style="margin: 0 0 8px; font-size: 14px; color: #09090b;"><strong>Monto:</strong> $${Number(charge.amount).toLocaleString("es-MX")} MXN</p>
                        <p style="margin: 0 0 8px; font-size: 14px; color: #09090b;"><strong>Fecha de cobro:</strong> ${dateStr}</p>
                        <p style="margin: 0; font-size: 14px; color: #09090b;"><strong>Frecuencia:</strong> ${charge.frequency === "monthly" ? "Mensual" : "Anual"}</p>
                      </div>
                      <p style="margin: 16px 0 0; font-size: 14px; color: #52525b;">
                        Si tiene alguna duda, no dude en contactarnos.
                      </p>
                      <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa;">— PixelTEC.MX</p>
                    </div>
                  </div>`;

                await sendEmail(
                  charge.clientEmail,
                  `Recordatorio de cobro — ${charge.concept}`,
                  html
                );
                notifications.push(`Email sent to ${charge.clientEmail} for ${charge.concept}`);
              } catch (e) {
                notifications.push(`Email FAILED to ${charge.clientEmail}: ${e}`);
              }
            }

            // 2. WhatsApp a Miguel
            const whatsappMsg =
              `*Cobro proximo — ${client.name}*\n\n` +
              `*Concepto:* ${charge.concept}\n` +
              `*Proyecto:* ${project.name}\n` +
              `*Monto:* $${Number(charge.amount).toLocaleString("es-MX")} MXN\n` +
              `*Fecha:* ${dateStr}\n` +
              `*Frecuencia:* ${charge.frequency === "monthly" ? "Mensual" : "Anual"}\n` +
              `*Cliente:* ${charge.clientEmail || "Sin email"}\n\n` +
              `pixeltec.mx/crm`;

            await sendWhatsApp(whatsappMsg);
            notifications.push(`WhatsApp sent for ${charge.concept} (${client.name})`);

            // 3. Marcar como notificado
            charge.lastNotified = notifKey;
            updated = true;
          }
        }
      }

      if (updated) {
        await db.collection("crm_data").doc(doc.id).set(data);
      }
    }

    return NextResponse.json({
      success: true,
      notificationsSent: notifications.length,
      details: notifications,
    });
  } catch (error: any) {
    console.error("Charges notification error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
