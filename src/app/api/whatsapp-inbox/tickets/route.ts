import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tickets } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth-guards";
import { parseJsonBody, toInboxFailure } from "@/lib/whatsapp-inbox/errors";

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

  const parsed = await parseJsonBody<{
    problema?: string;
    phone?: string;
    contactName?: string | null;
  }>(req);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Cuerpo JSON inválido", code: "invalid_body" }, { status: 400 });
  }
  const body = parsed.value;
  const problema = body.problema?.trim();
  if (!problema || !body.phone) {
    return NextResponse.json({ error: "problema y phone son requeridos" }, { status: 400 });
  }

  try {
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
    // Un error de Drizzle puede citar SQL, nombres de columna y constraints.
    const failure = toInboxFailure(error, "No se pudo crear el ticket.");
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status });
  }
}
