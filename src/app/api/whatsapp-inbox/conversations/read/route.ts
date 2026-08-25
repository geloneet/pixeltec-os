import { NextRequest, NextResponse } from "next/server";
import { requireWhatsAppReviewAccess } from "@/lib/auth-guards";
import { parseJsonBody, toInboxFailure } from "@/lib/whatsapp-inbox/errors";
import { fetchPixelbot } from "@/lib/whatsapp-inbox/pixelbot-client";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const guard = await requireWhatsAppReviewAccess(req.cookies.get("__session")?.value, {
    route: "/api/whatsapp-inbox/conversations/read",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const parsed = await parseJsonBody<{ phone?: unknown }>(req);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Cuerpo JSON inválido", code: "invalid_body" }, { status: 400 });
  }
  const { phone } = parsed.value;
  if (typeof phone !== "string" || !phone.trim()) {
    return NextResponse.json({ error: "phone es requerido" }, { status: 400 });
  }

  const tenantId = process.env.PIXELBOT_TENANT_ID;
  if (!tenantId) {
    return NextResponse.json({ error: "PIXELBOT_TENANT_ID no configurado" }, { status: 503 });
  }

  try {
    const { data, status } = await fetchPixelbot(
      "/internal/conversations/read",
      { tenant_id: tenantId, phone: phone.trim() },
      "POST"
    );
    return NextResponse.json(data, { status });
  } catch (error) {
    const failure = toInboxFailure(error, "No se pudo marcar la conversación como leída.");
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status });
  }
}
