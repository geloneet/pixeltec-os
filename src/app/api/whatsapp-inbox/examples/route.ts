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

  try {
    const activeOnly = req.nextUrl.searchParams.get("active_only") === "true";
    const { data, status } = await fetchPixelbot(
      `/internal/examples${activeOnly ? "?active_only=true" : ""}`,
      undefined,
      "GET"
    );
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
    const body = await req.json();
    const { customer_msg, ideal_reply } = body;
    if (typeof customer_msg !== "string" || !customer_msg.trim() || typeof ideal_reply !== "string" || !ideal_reply.trim()) {
      return NextResponse.json({ error: "customer_msg y ideal_reply son requeridos" }, { status: 400 });
    }

    const { data, status } = await fetchPixelbot("/internal/examples", {
      customer_msg,
      ideal_reply,
      category: body.category ?? null,
      intent: body.intent ?? null,
      tags: Array.isArray(body.tags) ? body.tags : [],
      manual_priority: typeof body.manual_priority === "number" ? body.manual_priority : 0,
      active: body.active !== false,
      created_by_uid: guard.uid,
    });
    return NextResponse.json(data, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Error al crear el ejemplo: " + message }, { status: 500 });
  }
}
