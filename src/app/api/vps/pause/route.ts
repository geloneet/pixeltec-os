import { NextRequest, NextResponse } from "next/server";
import { fetchVpsApi } from "@/lib/vpsClient";
import { requireAdmin } from "@/lib/auth-guards";
import { jsonFailure, toRouteFailure } from "@/lib/errors/route-failure";

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/vps/pause",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const body = await req.json();
    const { data, status } = await fetchVpsApi("/pause", {
      method: "POST",
      body,
    });
    return NextResponse.json(data, { status });
  } catch (error) {
    console.error("[vps/pause] error:", error);
    return jsonFailure(
      toRouteFailure(error, {
        code: "vps_pause_failed",
        message: "Pause failed",
        status: 500,
      })
    );
  }
}
