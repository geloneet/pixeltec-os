import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { fetchPixelbot } from "@/lib/whatsapp-inbox/pixelbot-client";

export const runtime = "nodejs";

const VALID_MODES = new Set(["BOT", "HUMAN", "PAUSED"]);

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
    const body = await req.json();
    const { message } = body;
    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "message es requerido" }, { status: 400 });
    }

    const mode = typeof body.mode === "string" ? body.mode : "BOT";
    if (!VALID_MODES.has(mode)) {
      return NextResponse.json({ error: "mode debe ser BOT, HUMAN o PAUSED" }, { status: 400 });
    }

    const { data, status } = await fetchPixelbot("/internal/simulate", {
      message,
      phone: typeof body.phone === "string" && body.phone.trim() ? body.phone : undefined,
      mode,
      version: typeof body.version === "number" ? body.version : undefined,
    });
    return NextResponse.json(data, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Error al simular la respuesta: " + message }, { status: 500 });
  }
}
