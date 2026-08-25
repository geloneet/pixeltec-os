import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireWhatsAppReviewAccess } from "@/lib/auth-guards";
import { parseJsonBody, toInboxFailure } from "@/lib/whatsapp-inbox/errors";
import { fetchPixelbot } from "@/lib/whatsapp-inbox/pixelbot-client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const guard = await requireWhatsAppReviewAccess(req.cookies.get("__session")?.value, {
    route: "/api/whatsapp-inbox/examples",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const activeOnly = req.nextUrl.searchParams.get("active_only");
  const path = activeOnly ? `/internal/examples?active_only=${encodeURIComponent(activeOnly)}` : "/internal/examples";

  try {
    const { data, status } = await fetchPixelbot(path, undefined, "GET");
    return NextResponse.json(data, { status });
  } catch (error) {
    const failure = toInboxFailure(error, "No se pudieron cargar los ejemplos.");
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status });
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/whatsapp-inbox/examples",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const parsed = await parseJsonBody<{
    customer_msg?: unknown;
    ideal_reply?: unknown;
    category?: unknown;
    intent?: unknown;
    tags?: unknown;
    manual_priority?: unknown;
    active?: unknown;
  }>(req);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Cuerpo JSON inválido", code: "invalid_body" }, { status: 400 });
  }
  const { customer_msg, ideal_reply, category, intent, tags, manual_priority, active } = parsed.value;
  if (typeof customer_msg !== "string" || !customer_msg.trim()) {
    return NextResponse.json({ error: "customer_msg es requerido" }, { status: 400 });
  }
  if (typeof ideal_reply !== "string" || !ideal_reply.trim()) {
    return NextResponse.json({ error: "ideal_reply es requerido" }, { status: 400 });
  }

  try {
    const { data, status } = await fetchPixelbot(
      "/internal/examples",
      {
        customer_msg,
        ideal_reply,
        category: category ?? null,
        intent: intent ?? null,
        tags: tags ?? [],
        manual_priority: manual_priority ?? 0,
        active: active ?? true,
        created_by_uid: guard.uid,
      },
      "POST"
    );
    return NextResponse.json(data, { status });
  } catch (error) {
    const failure = toInboxFailure(error, "No se pudo crear el ejemplo.");
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status });
  }
}
