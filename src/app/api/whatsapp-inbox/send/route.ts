import { NextRequest, NextResponse } from "next/server";
import { requireWhatsAppReviewAccess } from "@/lib/auth-guards";
import { assertWhatsAppEgressAllowed } from "@/lib/egress-guard";
import { parseJsonBody, toInboxFailure } from "@/lib/whatsapp-inbox/errors";
import { fetchPixelbot } from "@/lib/whatsapp-inbox/pixelbot-client";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const guard = await requireWhatsAppReviewAccess(req.cookies.get("__session")?.value, {
    route: "/api/whatsapp-inbox/send",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const parsed = await parseJsonBody<{ phone?: unknown; text?: unknown }>(req);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Cuerpo JSON inválido", code: "invalid_body" }, { status: 400 });
  }
  const { phone, text } = parsed.value;

  if (typeof phone !== "string" || !phone.trim() || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "phone y text son requeridos" }, { status: 400 });
  }
  if (text.length > 4096) {
    return NextResponse.json({ error: "text excede 4096 caracteres" }, { status: 400 });
  }

  const tenantId = process.env.PIXELBOT_TENANT_ID;
  if (!tenantId) {
    return NextResponse.json({ error: "PIXELBOT_TENANT_ID no configurado" }, { status: 503 });
  }

  try {
    // Doble guard. El canal `internal` autoriza *hablar con PixelBot*; este
    // autoriza *escribirle a este número*. Sin él, el camino
    // OS → PixelBot → Meta esquivaba el control de destinatarios que
    // `src/lib/whatsapp/sender.ts` sí aplica en el envío directo.
    assertWhatsAppEgressAllowed(phone.trim());

    const { data, status } = await fetchPixelbot("/internal/send", {
      tenant_id: tenantId,
      phone: phone.trim(),
      text,
      sent_by_uid: guard.uid,
    });
    return NextResponse.json(data, { status });
  } catch (error) {
    const failure = toInboxFailure(error, "No se pudo enviar el mensaje.");
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status });
  }
}
