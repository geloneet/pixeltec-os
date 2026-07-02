import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { fetchPixelbot } from "@/lib/whatsapp-inbox/pixelbot-client";

export const runtime = "nodejs";

const VALID_MODES = ["BOT", "HUMAN", "PAUSED"] as const;

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/whatsapp-inbox/mode",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const { phone, mode } = await req.json();
    if (typeof phone !== "string" || !phone.trim()) {
      return NextResponse.json({ error: "phone es requerido" }, { status: 400 });
    }
    if (!VALID_MODES.includes(mode)) {
      return NextResponse.json(
        { error: "mode debe ser BOT, HUMAN o PAUSED" },
        { status: 400 }
      );
    }

    const tenantId = process.env.PIXELBOT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "PIXELBOT_TENANT_ID no configurado" }, { status: 503 });
    }

    const { data, status } = await fetchPixelbot("/internal/conversations/mode", {
      tenant_id: tenantId,
      phone: phone.trim(),
      mode,
      changed_by_uid: guard.uid,
    });
    return NextResponse.json(data, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Mode change failed: " + message }, { status: 500 });
  }
}
