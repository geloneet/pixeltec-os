import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getProposalByToken, updateProposalActionStatus } from "@/lib/documents/proposals-admin";
import { buildProposalDecisionNotification, investmentSummary } from "@/lib/notifications/proposal-decision";
import { createNotification } from "@/lib/notifications/actions";
import { sendProposalDecisionEmail } from "@/lib/email";
import { sendWhatsApp } from "@/lib/whatsapp/sender";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json() as { token?: string; action?: string };
    const { token, action } = body;

    if (!token || (action !== "aceptada" && action !== "rechazada")) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const proposal = await getProposalByToken(token);
    if (!proposal) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const result = await updateProposalActionStatus(proposal, action);
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 409 });
    }

    // Avisos al staff DESPUÉS de responder al cliente. La transición de
    // estado es idempotente (segunda decisión -> 409 arriba), así que esto
    // corre exactamente una vez por propuesta. Cada canal va aislado en su
    // propio try/catch: un canal caído no tumba a los otros y la decisión
    // del cliente ya quedó guardada pase lo que pase.
    after(async () => {
      const messages = buildProposalDecisionNotification({
        action,
        title: proposal.title,
        clientName: proposal.clientName,
        billingItemDrafts: proposal.billingItemDrafts,
      });

      try {
        await sendWhatsApp(messages.whatsappText);
      } catch (err) {
        console.error("[proposals/action] notify whatsapp FAILED:", err);
      }

      try {
        await sendProposalDecisionEmail({
          action,
          title: proposal.title,
          clientName: proposal.clientName,
          investmentSummary: action === "aceptada" ? investmentSummary(proposal.billingItemDrafts) : "",
          decidedAt: new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" }),
          subject: messages.emailSubject,
        });
      } catch (err) {
        console.error("[proposals/action] notify email FAILED:", err);
      }

      try {
        const staff = await db.select({ id: users.id }).from(users);
        for (const u of staff) {
          await createNotification({
            userId: u.id,
            type: messages.inApp.type,
            title: messages.inApp.title,
            body: messages.inApp.body,
            href: "/crm",
            source: "proposal-decision",
          });
        }
      } catch (err) {
        console.error("[proposals/action] notify in-app FAILED:", err);
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[proposals/action]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
