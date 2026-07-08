import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tickets } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth-guards";

export const runtime = "nodejs";

/**
 * POST: crea un ticket de soporte desde el WhatsApp Inbox. Reemplaza el
 * `addDoc(collection(firestore, "tickets"), ...)` de ContactPanel.tsx — ese
 * write a Firestore nunca aparecía en el CRM ni en los portales, que ya leen
 * `tickets` desde Postgres (bug real encontrado al retirar Firebase, Fase E).
 * Body: `{ problema, phone, contactName? }`.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/whatsapp-inbox/tickets",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const body = (await req.json()) as { problema?: string; phone?: string; contactName?: string | null };
    const problema = body.problema?.trim();
    if (!problema || !body.phone) {
      return NextResponse.json({ error: "problema y phone son requeridos" }, { status: 400 });
    }

    const ticketId = `WA-${Date.now().toString(36).toUpperCase()}`;
    const [ticket] = await db
      .insert(tickets)
      .values({
        ticketId,
        cliente: body.contactName?.trim() || body.phone,
        problema,
        categoria: "whatsapp",
      })
      .returning();

    return NextResponse.json({ ticket });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Error al crear el ticket: " + message }, { status: 500 });
  }
}
