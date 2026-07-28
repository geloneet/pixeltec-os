import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { parseJsonBody, toInboxFailure } from "@/lib/whatsapp-inbox/errors";
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
      "/internal/config/draft",
      { config, created_by_uid: guard.uid },
      "POST"
    );
    return NextResponse.json(data, { status });
  } catch (error) {
    const failure = toInboxFailure(error, "No se pudo guardar el borrador.");
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status });
  }
}
