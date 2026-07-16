/**
 * GET /api/pixelforge/runs/:runId — shape público de una corrida IA, para el
 * poller del cliente (hook `usePixelforgeRun`). El repo (`getRunForOwner`,
 * F2-T4) ya devuelve solo los campos públicos (sin `inputSummary`/`model`/
 * tokens) y escopados por owner vía join — este route no filtra nada extra.
 *
 * Mismo patrón de auth que `src/app/api/definition/generate/route.ts`.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { getRunForOwner } from "@/lib/db/repos/pixelforge";

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

const runIdSchema = z.string().uuid("Corrida inválida");

export async function GET(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const session = await auth();
    const ownerId = session?.user?.id;
    if (!ownerId) return fail("No autenticado", 401);

    const { runId } = await params;
    const parsed = runIdSchema.safeParse(runId);
    if (!parsed.success) {
      return fail(parsed.error.errors[0]?.message ?? "Petición inválida", 400);
    }

    const run = await getRunForOwner(parsed.data, ownerId);
    if (!run) return fail("Corrida no encontrada", 404);

    return NextResponse.json(run);
  } catch (err) {
    console.error("[pixelforge/runs/:runId GET]", err);
    return fail("Error inesperado", 500);
  }
}
