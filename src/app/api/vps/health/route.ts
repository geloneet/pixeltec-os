import { NextRequest, NextResponse } from "next/server";
import { fetchVpsApi } from "@/lib/vpsClient";
import { requireAdmin } from "@/lib/auth-guards";
import { jsonFailure, toRouteFailure } from "@/lib/errors/route-failure";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/vps/health",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const { data, status } = await fetchVpsApi("/health");
    return NextResponse.json(data, { status });
  } catch (error) {
    console.error("[vps/health] error:", error);
    return jsonFailure(
      toRouteFailure(error, {
        code: "vps_health_failed",
        message: "Health check failed",
        status: 500,
      })
    );
  }
}
