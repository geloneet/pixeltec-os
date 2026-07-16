import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { fetchPixelbot } from "@/lib/whatsapp-inbox/pixelbot-client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/whatsapp-inbox/memory",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const phone = req.nextUrl.searchParams.get("phone");
  if (!phone || !phone.trim()) {
    return NextResponse.json({ error: "phone es requerido" }, { status: 400 });
  }

  try {
    const { data, status } = await fetchPixelbot(
      `/internal/memory?phone=${encodeURIComponent(phone)}`,
      undefined,
      "GET"
    );
    return NextResponse.json(data, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Error al cargar la memoria: " + message }, { status: 500 });
  }
}
