// src/app/api/crypto-intel/alerts/evaluate/route.ts
// Cron endpoint: se llama cada minuto.
// Evalúa todas las reglas activas y dispara alertas si corresponde.

import { NextRequest, NextResponse } from "next/server";
import { evaluateAllAlerts } from "@/lib/crypto-intel/alert-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const summary = await evaluateAllAlerts();
    console.log("[cron:alerts/evaluate]", summary);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[cron:alerts/evaluate] error", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
