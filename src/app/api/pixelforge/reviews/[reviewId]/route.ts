/**
 * GET /api/pixelforge/reviews/:reviewId — detalle de una revisión + sus
 * comentarios (`getReviewWithComments`, T3, ownership-checked vía join).
 * Mismo molde que `qa/runs/[qaRunId]/decision/route.ts`: auth → 401; zod →
 * 400; null → 404.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { getReviewWithComments } from "@/lib/db/repos/pixelforge";

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

const reviewIdSchema = z.string().uuid("Revisión inválida");

export async function GET(_req: NextRequest, { params }: { params: Promise<{ reviewId: string }> }) {
  try {
    const session = await auth();
    const ownerId = session?.user?.id;
    if (!ownerId) return fail("No autenticado", 401);

    const { reviewId } = await params;
    const parsed = reviewIdSchema.safeParse(reviewId);
    if (!parsed.success) {
      return fail(parsed.error.errors[0]?.message ?? "Petición inválida", 400);
    }

    const result = await getReviewWithComments(parsed.data, ownerId);
    if (!result) return fail("Revisión no encontrada", 404);

    return NextResponse.json({ review: result.review, comments: result.comments });
  } catch (err) {
    console.error("[pixelforge/reviews/:reviewId GET]", err);
    return fail("Error inesperado", 500);
  }
}
