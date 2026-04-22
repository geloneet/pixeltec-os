"use server";
import { requireAdmin } from "../auth";
import { syncPrices } from "../price-engine";
import { evaluateAllAlerts } from "../alert-engine";
import { log } from "../logger";

export async function adminForceSync(): Promise<{
  ok: boolean;
  data?: { synced: number; durationMs: number };
  error?: string;
}> {
  const { uid } = await requireAdmin();

  try {
    const result = await syncPrices();
    await log("admin", "info", "Sync manual forzado", { uid, result });
    return { ok: true, data: { synced: result.synced, durationMs: result.durationMs } };
  } catch (err) {
    await log("admin", "error", "Sync manual fallido", { uid, error: String(err) });
    return { ok: false, error: String(err) };
  }
}

export async function adminForceEvaluate(): Promise<{
  ok: boolean;
  data?: { triggered: number };
  error?: string;
}> {
  const { uid } = await requireAdmin();

  try {
    const result = await evaluateAllAlerts();
    await log("admin", "info", "Evaluación manual de alertas", { uid, result });
    return { ok: true, data: { triggered: result.triggered } };
  } catch (err) {
    await log("admin", "error", "Evaluación manual fallida", { uid, error: String(err) });
    return { ok: false, error: String(err) };
  }
}
