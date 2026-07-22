/**
 * POST /api/pixelforge/reviews/:reviewId/reanchor — sin body: re-ancla una
 * revisión ABIERTA al QA cerrado más reciente de su misma versión
 * (`reanchorReview`, T3, lock de proyecto + **CAS** sobre `status='in_review'`).
 *
 * Mismo molde que `qa/runs/[qaRunId]/decision/route.ts`: auth → 401;
 * "Revisión no encontrada" → 404; `ReviewConflictError` (CAS perdido) y
 * cualquier otro error de negocio (revisión no abierta, sin QA cerrado que
 * abra la compuerta, ya anclada al más reciente) → 409 con el mensaje del
 * repo.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { reanchorReview, ReviewConflictError, type Actor } from "@/lib/db/repos/pixelforge";

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

const NOT_FOUND_MESSAGES = new Set(["Revisión no encontrada"]);

const reviewIdSchema = z.string().uuid("Revisión inválida");

export async function POST(_req: NextRequest, { params }: { params: Promise<{ reviewId: string }> }) {
  try {
    const session = await auth();
    const ownerId = session?.user?.id;
    if (!ownerId) return fail("No autenticado", 401);
    const actor: Actor = {
      id: ownerId,
      name: session.user?.name ?? session.user?.email ?? "Usuario",
    };

    const { reviewId } = await params;
    const parsed = reviewIdSchema.safeParse(reviewId);
    if (!parsed.success) {
      return fail(parsed.error.errors[0]?.message ?? "Petición inválida", 400);
    }

    try {
      await reanchorReview(parsed.data, ownerId, actor);
    } catch (err) {
      if (err instanceof ReviewConflictError) return fail(err.message, 409);
      const message = err instanceof Error ? err.message : "No se pudo re-anclar la revisión";
      return fail(message, NOT_FOUND_MESSAGES.has(message) ? 404 : 409);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[pixelforge/reviews/:reviewId/reanchor POST]", err);
    return fail("Error inesperado", 500);
  }
}
