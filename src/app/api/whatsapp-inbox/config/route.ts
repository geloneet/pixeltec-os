import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireWhatsAppReviewAccess } from "@/lib/auth-guards";
import { parseJsonBody, toInboxFailure } from "@/lib/whatsapp-inbox/errors";
import { fetchPixelbot } from "@/lib/whatsapp-inbox/pixelbot-client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const guard = await requireWhatsAppReviewAccess(req.cookies.get("__session")?.value, {
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
    const failure = toInboxFailure(error, "No se pudo cargar la configuración.");
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status });
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

  const parsed = await parseJsonBody<{ config?: unknown }>(req);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Cuerpo JSON inválido", code: "invalid_body" }, { status: 400 });
  }
  const { config } = parsed.value;
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return NextResponse.json({ error: "config debe ser un objeto válido" }, { status: 400 });
  }

  try {
    const { data, status } = await fetchPixelbot(
      "/internal/config",
      { config, updated_by_uid: guard.uid },
      "PUT"
    );
    return NextResponse.json(data, { status });
  } catch (error) {
    const failure = toInboxFailure(error, "No se pudo guardar la configuración.");
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status });
  }
}
