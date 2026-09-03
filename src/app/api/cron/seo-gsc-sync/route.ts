import { NextRequest, NextResponse } from "next/server";
import { assertCronExecutionAllowed, cronBlockedResponse } from "@/lib/cron-guard";
import { runGscSync } from "@/lib/seo-insights/gsc-sync";
import { isGscConfigured } from "@/lib/google/gsc-egress";
import { GSC_PROPERTY } from "@/lib/seo-insights/config";
import { toRouteFailure } from "@/lib/errors/route-failure";

/**
 * Sincronización diaria de Google Search Console (WO-2026-00214).
 *
 * Mismo esqueleto que `api/cron/recurring-charges`: secreto primero (para que
 * una llamada sin credencial reciba 401 y no aprenda si el cron está activo),
 * después `assertCronExecutionAllowed()` (contrato E0), y sólo entonces el
 * trabajo.
 *
 * Sin credencial de Google responde 200 con `skipped`, no un error: un entorno
 * donde Search Console todavía no está conectado NO está roto — es el estado
 * normal hasta que Miguel cargue `GOOGLE_SERVICE_ACCOUNT_JSON`. Devolver 500
 * ahí llenaría el log del cron de falsas alarmas todos los días.
 *
 * Registro en crontab: docs/deploy/cron-seo-gsc-sync.md
 */
export async function GET(req: NextRequest) {
  const provided =
    req.headers.get("authorization")?.replace("Bearer ", "") ?? req.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET || provided !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    assertCronExecutionAllowed();
  } catch (err) {
    const blocked = cronBlockedResponse(err);
    if (blocked) return blocked;
    throw err;
  }

  if (!isGscConfigured() || GSC_PROPERTY.trim() === "") {
    return NextResponse.json({ success: true, skipped: "gsc_not_configured" });
  }

  try {
    const result = await runGscSync();
    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    console.error("[seo-gsc-sync-cron] error:", error);
    const failure = toRouteFailure(error, {
      code: "seo_gsc_sync_failed",
      message: "No se pudo sincronizar Search Console.",
      status: 500,
    });
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status });
  }
}
