import { NextRequest, NextResponse } from "next/server";
import { fetchVpsApi } from "@/lib/vpsClient";
import { requireAdmin } from "@/lib/auth-guards";
import { jsonFailure, toRouteFailure } from "@/lib/errors/route-failure";
import { auth } from "@/lib/auth/config";
import type { VpsBackupResult } from "@/lib/vps-types";

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/vps/backup",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  // El actor SIEMPRE sale de la sesión autenticada, nunca del body del request.
  const session = await auth();
  const actor = session?.user?.name || session?.user?.email || guard.uid;

  try {
    const { data, status } = await fetchVpsApi<VpsBackupResult>("/actions/backup", {
      method: "POST",
      body: { actor },
    });
    return NextResponse.json(data, { status });
  } catch (error) {
    console.error("[vps/backup] error:", error);
    return jsonFailure(
      toRouteFailure(error, {
        code: "vps_backup_failed",
        message: "Backup failed",
        status: 500,
      })
    );
  }
}
