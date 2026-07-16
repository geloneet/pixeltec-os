import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { fetchPixelbot } from "@/lib/whatsapp-inbox/pixelbot-client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
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
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Error al cargar los ejemplos: " + message }, { status: 500 });
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

  try {
    const { customer_msg, ideal_reply, category, intent, tags, manual_priority, active } = await req.json();
    if (typeof customer_msg !== "string" || !customer_msg.trim()) {
      return NextResponse.json({ error: "customer_msg es requerido" }, { status: 400 });
    }
    if (typeof ideal_reply !== "string" || !ideal_reply.trim()) {
      return NextResponse.json({ error: "ideal_reply es requerido" }, { status: 400 });
    }

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
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Error al crear el ejemplo: " + message }, { status: 500 });
  }
}
