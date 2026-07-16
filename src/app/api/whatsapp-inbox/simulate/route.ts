import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { fetchPixelbot } from "@/lib/whatsapp-inbox/pixelbot-client";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/whatsapp-inbox/simulate",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const { message, phone, mode, version } = await req.json();
    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "message es requerido" }, { status: 400 });
    }

    const payload: Record<string, unknown> = { message };
    if (typeof phone === "string" && phone) payload.phone = phone;
    if (typeof mode === "string" && mode) payload.mode = mode;
    if (typeof version === "number") payload.version = version;

    const { data, status } = await fetchPixelbot("/internal/simulate", payload, "POST");
    return NextResponse.json(data, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Error al simular: " + message }, { status: 500 });
  }
}
