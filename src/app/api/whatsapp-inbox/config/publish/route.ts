import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { fetchPixelbot } from "@/lib/whatsapp-inbox/pixelbot-client";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/whatsapp-inbox/config/publish",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const { version } = await req.json();
    if (typeof version !== "number" || !Number.isInteger(version)) {
      return NextResponse.json({ error: "version debe ser un entero" }, { status: 400 });
    }

    const { data, status } = await fetchPixelbot("/internal/config/publish", {
      version,
      published_by_uid: guard.uid,
    });
    return NextResponse.json(data, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Error al publicar la versión: " + message }, { status: 500 });
  }
}
