import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { fetchPixelbot } from "@/lib/whatsapp-inbox/pixelbot-client";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/whatsapp-inbox/examples/[id]/active",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const { id } = await params;
    const exampleId = Number(id);
    if (!Number.isInteger(exampleId)) {
      return NextResponse.json({ error: "id debe ser un entero" }, { status: 400 });
    }

    const { active } = await req.json();
    if (typeof active !== "boolean") {
      return NextResponse.json({ error: "active debe ser booleano" }, { status: 400 });
    }

    const { data, status } = await fetchPixelbot(`/internal/examples/${exampleId}/active`, { active });
    return NextResponse.json(data, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Error al actualizar el ejemplo: " + message }, { status: 500 });
  }
}
