import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { fetchPixelbot } from "@/lib/whatsapp-inbox/pixelbot-client";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ phone: string }> }) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/whatsapp-inbox/conversations/[phone]/messages",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const { phone } = await params;
    const tenantId = process.env.PIXELBOT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "PIXELBOT_TENANT_ID no configurado" }, { status: 503 });
    }

    const { data, status } = await fetchPixelbot(
      `/internal/conversations/${encodeURIComponent(phone)}/messages?tenant_id=${encodeURIComponent(tenantId)}&limit=200`,
      undefined,
      "GET"
    );
    return NextResponse.json(data, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Error al obtener mensajes: " + message }, { status: 500 });
  }
}
