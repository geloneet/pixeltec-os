import { NextRequest, NextResponse } from "next/server";
import { requireWhatsAppReviewAccess } from "@/lib/auth-guards";
import { toInboxFailure } from "@/lib/whatsapp-inbox/errors";
import { fetchPixelbot } from "@/lib/whatsapp-inbox/pixelbot-client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const guard = await requireWhatsAppReviewAccess(req.cookies.get("__session")?.value, {
    route: "/api/whatsapp-inbox/config/versions",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const { data, status } = await fetchPixelbot("/internal/config/versions", undefined, "GET");
    return NextResponse.json(data, { status });
  } catch (error) {
    const failure = toInboxFailure(error, "No se pudieron cargar las versiones.");
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status });
  }
}
