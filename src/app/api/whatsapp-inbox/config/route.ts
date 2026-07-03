import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { fetchPixelbot } from "@/lib/whatsapp-inbox/pixelbot-client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/whatsapp-inbox/config",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const { data, status } = await fetchPixelbot("/internal/config", undefined, "GET");
    return NextResponse.json(data, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Error al cargar la configuración: " + message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/whatsapp-inbox/config",
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

    const { data, status } = await fetchPixelbot("/internal/config", {
      config,
      updated_by_uid: guard.uid,
    }, "PUT");
    return NextResponse.json(data, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Error al guardar la configuración: " + message }, { status: 500 });
  }
}
