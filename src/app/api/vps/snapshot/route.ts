import { NextRequest, NextResponse } from "next/server";
import { fetchVpsApi } from "@/lib/vpsClient";
import { requireAdmin } from "@/lib/auth-guards";
import { jsonFailure, toRouteFailure } from "@/lib/errors/route-failure";
import type { VpsSnapshot } from "@/lib/vps-types";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/vps/snapshot",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const { data, status } = await fetchVpsApi<VpsSnapshot>("/health/snapshot");
    return NextResponse.json(data, { status });
  } catch (error) {
    console.error("[vps/snapshot] error:", error);
    return jsonFailure(
      toRouteFailure(error, {
        code: "vps_snapshot_failed",
        message: "Failed to fetch VPS snapshot",
        status: 500,
      })
    );
  }
}
