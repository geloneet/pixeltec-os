import { NextRequest, NextResponse } from "next/server";
import { requireWhatsAppReviewAccess } from "@/lib/auth-guards";
import { parseJsonBody, toInboxFailure } from "@/lib/whatsapp-inbox/errors";
import { fetchPixelbot } from "@/lib/whatsapp-inbox/pixelbot-client";

export const runtime = "nodejs";

const VALID_MODES = ["BOT", "HUMAN", "PAUSED"] as const;

export async function POST(req: NextRequest) {
  const guard = await requireWhatsAppReviewAccess(req.cookies.get("__session")?.value, {
    route: "/api/whatsapp-inbox/mode",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const parsed = await parseJsonBody<{ phone?: unknown; mode?: unknown; pausedUntil?: unknown }>(req);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Cuerpo JSON inválido", code: "invalid_body" }, { status: 400 });
  }
  const { phone, mode, pausedUntil } = parsed.value;

  if (typeof phone !== "string" || !phone.trim()) {
    return NextResponse.json({ error: "phone es requerido" }, { status: 400 });
  }
  if (!VALID_MODES.includes(mode as (typeof VALID_MODES)[number])) {
    return NextResponse.json({ error: "mode debe ser BOT, HUMAN o PAUSED" }, { status: 400 });
  }

  let pausedUntilCanonical: string | undefined;
  if (pausedUntil !== undefined && pausedUntil !== null) {
    if (mode !== "PAUSED") {
      return NextResponse.json({ error: "pausedUntil solo aplica con mode=PAUSED" }, { status: 400 });
    }
    if (typeof pausedUntil !== "string") {
      return NextResponse.json({ error: "pausedUntil inválido (usa ISO 8601)" }, { status: 400 });
    }
    const ms = Date.parse(pausedUntil);
    if (isNaN(ms)) {
      return NextResponse.json({ error: "pausedUntil inválido (usa ISO 8601)" }, { status: 400 });
    }
    if (ms <= Date.now()) {
      return NextResponse.json({ error: "pausedUntil debe ser una fecha futura" }, { status: 400 });
    }
    pausedUntilCanonical = new Date(ms).toISOString().slice(0, 19).replace("T", " ");
  }

  const tenantId = process.env.PIXELBOT_TENANT_ID;
  if (!tenantId) {
    return NextResponse.json({ error: "PIXELBOT_TENANT_ID no configurado" }, { status: 503 });
  }

  try {
    const { data, status } = await fetchPixelbot("/internal/conversations/mode", {
      tenant_id: tenantId,
      phone: phone.trim(),
      mode,
      changed_by_uid: guard.uid,
      ...(pausedUntilCanonical ? { paused_until: pausedUntilCanonical } : {}),
    });
    return NextResponse.json(data, { status });
  } catch (error) {
    const failure = toInboxFailure(error, "No se pudo cambiar el modo.");
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status });
  }
}
