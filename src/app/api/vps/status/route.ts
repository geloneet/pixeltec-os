import { NextRequest, NextResponse } from "next/server";
import { fetchVpsApi, sanitizeVpsPayload, type VpsStatusResponse } from "@/lib/vpsClient";
import { requireAdmin } from "@/lib/auth-guards";
import { jsonFailure, toRouteFailure } from "@/lib/errors/route-failure";

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
    console.error("[vps/status] error:", error);
    return jsonFailure(
      toRouteFailure(error, {
        code: "vps_status_failed",
        message: "Failed to connect to VPS API",
        status: 500,
      })
    );
  }
}
