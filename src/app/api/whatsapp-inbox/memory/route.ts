import { NextRequest, NextResponse } from "next/server";
import { requireWhatsAppReviewAccess } from "@/lib/auth-guards";
import { toInboxFailure } from "@/lib/whatsapp-inbox/errors";
import { fetchPixelbot } from "@/lib/whatsapp-inbox/pixelbot-client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const guard = await requireWhatsAppReviewAccess(req.cookies.get("__session")?.value, {
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
    const failure = toInboxFailure(error, "No se pudo cargar la memoria.");
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status });
  }
}
