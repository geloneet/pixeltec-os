import { NextRequest, NextResponse } from "next/server";
import { requireWhatsAppReviewAccess } from "@/lib/auth-guards";
import { parseJsonBody, toInboxFailure } from "@/lib/whatsapp-inbox/errors";
import { fetchPixelbot } from "@/lib/whatsapp-inbox/pixelbot-client";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const guard = await requireWhatsAppReviewAccess(req.cookies.get("__session")?.value, {
    route: "/api/whatsapp-inbox/simulate",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const parsed = await parseJsonBody<{
    message?: unknown;
    phone?: unknown;
    mode?: unknown;
    version?: unknown;
  }>(req);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Cuerpo JSON inválido", code: "invalid_body" }, { status: 400 });
  }
  const { message, phone, mode, version } = parsed.value;
  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "message es requerido" }, { status: 400 });
  }

  const payload: Record<string, unknown> = { message };
  if (typeof phone === "string" && phone) payload.phone = phone;
  if (typeof mode === "string" && mode) payload.mode = mode;
  if (typeof version === "number") payload.version = version;

  try {
    const { data, status } = await fetchPixelbot("/internal/simulate", payload, "POST");
    return NextResponse.json(data, { status });
  } catch (error) {
    const failure = toInboxFailure(error, "No se pudo simular la respuesta.");
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status });
  }
}
