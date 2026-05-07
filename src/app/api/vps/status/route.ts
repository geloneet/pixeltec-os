import { NextRequest, NextResponse } from "next/server";
import { fetchVpsApi, sanitizeVpsPayload, type VpsStatusResponse } from "@/lib/vpsClient";
import { requireAdmin } from "@/lib/auth-guards";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/vps/status",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const { data, status } = await fetchVpsApi<VpsStatusResponse>("/status");
    return NextResponse.json(sanitizeVpsPayload(data, guard.isAdmin), { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to connect to VPS API: " + message },
      { status: 500 }
    );
  }
}
