import { NextRequest, NextResponse } from "next/server";
import { sendWhatsApp } from "@/lib/whatsapp/sender";
import { sendEmail } from "@/lib/email";
import { getAdminApp } from "@/lib/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getNextChargeDate } from "@/lib/crm/next-charge-date";
import { createNotification } from "@/lib/notifications/actions";

/**
 * Marca `lastNotified` en un cargo puntual dentro de `crm_data/{docId}`.
 *
 * Vuelve a leer el documento DENTRO de la transacción (no usa la copia leída
 * al inicio del loop del cron) y sólo reescribe el campo `clients`, aplicando
 * la mutación puntual sobre los datos frescos. Esto evita que el cron pise
 * ediciones concurrentes del usuario (dashboard) u otras pestañas: si el doc
 * cambió entre la lectura y la escritura, Firestore reintenta la transacción
 * automáticamente con el estado más reciente.
 */
async function markChargeNotified(
  db: FirebaseFirestore.Firestore,
  docId: string,
  clientId: string,
  projectId: string,
  chargeId: string,
  notifKey: string
): Promise<void> {
  const docRef = db.collection("crm_data").doc(docId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists) return;
    const freshData = snap.data();
    if (!freshData) return;

    let found = false;
    const freshClients = (freshData.clients || []).map((c: any) => {
      if (c.id !== clientId) return c;
      return {
        ...c,
        projects: (c.projects || []).map((p: any) => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            charges: (p.charges || []).map((ch: any) => {
              if (ch.id !== chargeId) return ch;
              found = true;
              return { ...ch, lastNotified: notifKey };
            }),
          };
        }),
      };
    });

    if (!found) return;
    tx.update(docRef, { clients: freshClients });
  });
}

export async function GET(req: NextRequest) {
  const provided = req.headers.get("authorization")?.replace("Bearer ", "") ?? req.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET || provided !== process.env.CRON_SECRET) {
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
            // emailOk determines whether we mark this charge as notified:
            // sendEmail() never throws — it returns { success: false, error }
            // on failure — so we must check `result.success` explicitly.
            // If it failed, we don't mark lastNotified so the cron retries
            // sending the email next run instead of silently giving up.
            let emailOk = true;
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

                const result = await sendEmail(
                  charge.clientEmail,
                  `Recordatorio de cobro — ${charge.concept}`,
                  html
                );
                if (result.success) {
                  notifications.push(`Email sent to ${charge.clientEmail} for ${charge.concept}`);
                } else {
                  emailOk = false;
                  notifications.push(`Email FAILED to ${charge.clientEmail}: ${result.error}`);
                }
              } catch (e) {
                emailOk = false;
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

            // 3. In-app notification
            try {
              const frequencyLabel =
                charge.frequency === "monthly" ? "mensual" : "anual";
              const body =
                `${charge.concept} — $${Number(charge.amount).toLocaleString("es-MX")} MXN (${frequencyLabel}). Cobro el ${dateStr}.`;
              await createNotification({
                userId: doc.id,
                type: "warning",
                title: "Cobro próximo",
                body,
                href: `/cobros`,
                source: "charges-cron",
                metadata: {
                  clientId: client.id ?? null,
                  projectId: project.id ?? null,
                  chargeId: charge.id ?? null,
                },
              });
            } catch (e) {
              notifications.push(`In-app notification FAILED for ${charge.concept}: ${e}`);
            }

            // 4. Marcar como notificado — sólo si el email (cuando aplica)
            // se envió exitosamente. Se hace vía transacción que relee el
            // doc fresco en vez de acumular sobre `data` (leído una sola vez
            // al inicio del loop) y hacer un `.set()` de todo el documento,
            // que pisaría ediciones concurrentes del usuario.
            if (emailOk) {
              try {
                await markChargeNotified(db, doc.id, client.id, project.id, charge.id, notifKey);
              } catch (e) {
                notifications.push(`Failed to persist lastNotified for ${charge.concept}: ${e}`);
              }
            }
          }
        }
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
