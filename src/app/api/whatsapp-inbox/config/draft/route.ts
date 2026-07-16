import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { fetchPixelbot } from "@/lib/whatsapp-inbox/pixelbot-client";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/whatsapp-inbox/config/draft",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const { config } = await req.json();
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      return NextResponse.json({ error: "config debe ser un objeto válido" }, { status: 400 });
    }

    const { data, status } = await fetchPixelbot(
      "/internal/config/draft",
      { config, created_by_uid: guard.uid },
      "POST"
    );
    return NextResponse.json(data, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Error al guardar el borrador: " + message }, { status: 500 });
  }
}
