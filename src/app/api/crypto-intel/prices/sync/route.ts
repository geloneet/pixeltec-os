// src/app/api/crypto-intel/prices/sync/route.ts
// Cron endpoint: se llama cada minuto desde Vercel Cron (vercel.json).
// Sincroniza precios de watchlist desde CoinGecko → Firestore.

import { NextRequest, NextResponse } from "next/server";
import { syncPrices } from "@/lib/crypto-intel/price-engine";
import { log } from "@/lib/crypto-intel/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  // Autorización: Vercel Cron envía header con CRON_SECRET
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const result = await syncPrices();
    console.log("[cron:prices/sync]", result);
    await log("price-sync", "info", `Sync completado: ${result.synced} assets`, { durationMs: result.durationMs, failed: result.failed });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron:prices/sync] error", err);
    await log("price-sync", "error", `Sync fallido: ${String(err)}`, {});
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
