/**
 * GET /api/pixelforge/qa/runs/:qaRunId — corrida de QA + sus hallazgos, para
 * el poller del cliente (hook `usePixelforgeQaRun`). Ownership-checked vía
 * `getQaRunWithFindings` (T1, join a `pixelforgeProjects`).
 *
 * "Lazy finalize": si el run sigue `running`, este GET intenta cerrarlo
 * (`finalizeQaRunOrchestrated`, T4) ANTES de responder — así el cliente que
 * pollea cada ~2s (mismo patrón que `usePixelforgeRun`) eventualmente ve el
 * cierre sin depender de un cron/worker aparte; `finalizeQaRunOrchestrated`
 * es un no-op si las condiciones de cierre todavía no se cumplen (browser
 * pendiente, advisory sin resolver). `sweepStaleQaRuns` corre antes,
 * acotado al proyecto de ESTE run (no barre toda la tabla en cada poll).
 *
 * Mismo patrón de auth que `src/app/api/pixelforge/runs/[runId]/route.ts`.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { getQaRunWithFindings, sweepStaleQaRuns } from "@/lib/db/repos/pixelforge";
import { finalizeQaRunOrchestrated } from "@/lib/pixelforge/qa/finalize";

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

const qaRunIdSchema = z.string().uuid("QA inválido");

export async function GET(_req: NextRequest, { params }: { params: Promise<{ qaRunId: string }> }) {
  try {
    const session = await auth();
    const ownerId = session?.user?.id;
    if (!ownerId) return fail("No autenticado", 401);

    const { qaRunId } = await params;
    const parsed = qaRunIdSchema.safeParse(qaRunId);
    if (!parsed.success) {
      return fail(parsed.error.errors[0]?.message ?? "Petición inválida", 400);
    }

    const existing = await getQaRunWithFindings(parsed.data, ownerId);
    if (!existing) return fail("QA no encontrado", 404);

    await sweepStaleQaRuns(existing.run.projectId);

    if (existing.run.status === "running") {
      await finalizeQaRunOrchestrated(parsed.data);
    }

    // Re-lee tras el sweep/finalize — su estado puede haber cambiado.
    const result = await getQaRunWithFindings(parsed.data, ownerId);
    if (!result) return fail("QA no encontrado", 404);

    return NextResponse.json(result);
  } catch (err) {
    console.error("[pixelforge/qa/runs/:qaRunId GET]", err);
    return fail("Error inesperado", 500);
  }
}
