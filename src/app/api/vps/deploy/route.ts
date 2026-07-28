import { NextRequest, NextResponse } from "next/server";
import { deployVpsProject } from "@/lib/vpsClient";
import { requireAdmin } from "@/lib/auth-guards";
import { jsonFailure, toRouteFailure } from "@/lib/errors/route-failure";

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/vps/deploy",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const body = await req.json();
    const { data, status } = await deployVpsProject(body.projectId);
    return NextResponse.json(data, { status });
  } catch (error) {
    console.error("[vps/deploy] error:", error);
    return jsonFailure(
      toRouteFailure(error, {
        code: "vps_deploy_failed",
        message: "Deploy failed",
        status: 500,
      })
    );
  }
}
