import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { fetchPixelbot } from "@/lib/whatsapp-inbox/pixelbot-client";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/whatsapp-inbox/send",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const { phone, text } = await req.json();
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

    const { data, status } = await fetchPixelbot("/internal/send", {
      tenant_id: tenantId,
      phone: phone.trim(),
      text,
      sent_by_uid: guard.uid,
    });
    return NextResponse.json(data, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Send failed: " + message }, { status: 500 });
  }
}
