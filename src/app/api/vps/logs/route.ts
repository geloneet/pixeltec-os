import { NextRequest, NextResponse } from "next/server";
import { fetchVpsApi } from "@/lib/vpsClient";
import { requireAdmin } from "@/lib/auth-guards";
import { jsonFailure, toRouteFailure } from "@/lib/errors/route-failure";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/vps/logs",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const projectId = req.nextUrl.searchParams.get("project");
  const lines = req.nextUrl.searchParams.get("lines") || "10";
  const filter = req.nextUrl.searchParams.get("filter") || "";

  try {
    const { data, status } = await fetchVpsApi("/logs", {
      query: {
        project: projectId ?? undefined,
        lines,
        filter: filter || undefined,
      },
    });
    return NextResponse.json(data, { status });
  } catch (error) {
    console.error("[vps/logs] error:", error);
    return jsonFailure(
      toRouteFailure(error, {
        code: "vps_logs_failed",
        message: "Logs failed",
        status: 500,
      })
    );
  }
}
