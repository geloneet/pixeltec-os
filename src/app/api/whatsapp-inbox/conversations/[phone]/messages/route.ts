import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { toInboxFailure } from "@/lib/whatsapp-inbox/errors";
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

  const tenantId = process.env.PIXELBOT_TENANT_ID;
  if (!tenantId) {
    return NextResponse.json({ error: "PIXELBOT_TENANT_ID no configurado" }, { status: 503 });
  }

  try {
    const { phone } = await params;
    const { data, status } = await fetchPixelbot(
      `/internal/conversations/${encodeURIComponent(phone)}/messages?tenant_id=${encodeURIComponent(tenantId)}&limit=200`,
      undefined,
      "GET"
    );
    return NextResponse.json(data, { status });
  } catch (error) {
    const failure = toInboxFailure(error, "No se pudieron obtener los mensajes.");
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status });
  }
}
