import { NextRequest, NextResponse } from "next/server";
import { fetchVpsApi } from "@/lib/vpsClient";
import { requireAdmin } from "@/lib/auth-guards";
import { jsonFailure, toRouteFailure } from "@/lib/errors/route-failure";
import type { VpsAuditReport } from "@/lib/vps-types";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/vps/audit",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const { data, status } = await fetchVpsApi<VpsAuditReport>("/health/audit");
    return NextResponse.json(data, { status });
  } catch (error) {
    console.error("[vps/audit] error:", error);
    return jsonFailure(
      toRouteFailure(error, {
        code: "vps_audit_failed",
        message: "Failed to fetch VPS audit",
        status: 500,
      })
    );
  }
}
