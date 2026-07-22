/**
 * POST /api/pixelforge/reviews/:reviewId/comments/:commentId/resolution —
 * resuelve o descarta un comentario (`resolveReviewComment`, T3, **CAS**
 * sobre `status='open'`). `resolveReviewComment` recibe solo `commentId`
 * (no `reviewId`) — para blindar contra URLs cruzadas (`/reviews/A/comments/B/resolution`
 * donde B pertenece a la revisión C) este handler valida ANTES de llamar al
 * repo que `commentId` de verdad pertenece a la revisión `reviewId` del path,
 * usando `getReviewWithComments` (ya existente, ownership-checked): si la
 * revisión no existe o el comentario no está en su lista → 404, sin tocar el
 * repo de escritura ni su firma.
 *
 * Mismo molde que `qa/runs/route.ts` (L114-117): mapeo por `instanceof` —
 * `ReviewConflictError` (CAS perdido) → 409 con el mensaje del repo;
 * cualquier otro error de `resolveReviewComment` se re-lanza al catch global
 * → 500 "Error inesperado" sin exponer su mensaje (PF-F9 T4 fix). El
 * "Comentario no encontrado" propio de `resolveReviewComment` (ahora
 * `ReviewNotFoundError`) nunca debería alcanzar este catch en la práctica —
 * el guard IDOR de abajo (`getReviewWithComments` + `.some`) ya lo descarta
 * ANTES de llamar al repo de escritura — pero se mapea igual por completitud
 * y defensa en profundidad.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import {
  getReviewWithComments,
  resolveReviewComment,
  ReviewNotFoundError,
  ReviewRuleError,
  ReviewConflictError,
  type Actor,
} from "@/lib/db/repos/pixelforge";

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

const reviewIdSchema = z.string().uuid("Revisión inválida");
const commentIdSchema = z.string().uuid("Comentario inválido");

const resolutionSchema = z.object({
  finalStatus: z.enum(["resolved", "dismissed"], {
    errorMap: () => ({ message: "Estado final inválido" }),
  }),
  reason: z.string().trim().min(5, "La razón debe tener al menos 5 caracteres"),
  evidence: z.unknown().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string; commentId: string }> }
) {
  try {
    const session = await auth();
    const ownerId = session?.user?.id;
    if (!ownerId) return fail("No autenticado", 401);
    const actor: Actor = {
      id: ownerId,
      name: session.user?.name ?? session.user?.email ?? "Usuario",
    };

    const { reviewId, commentId } = await params;
    const parsedReviewId = reviewIdSchema.safeParse(reviewId);
    if (!parsedReviewId.success) {
      return fail(parsedReviewId.error.errors[0]?.message ?? "Petición inválida", 400);
    }
    const parsedCommentId = commentIdSchema.safeParse(commentId);
    if (!parsedCommentId.success) {
      return fail(parsedCommentId.error.errors[0]?.message ?? "Petición inválida", 400);
    }

    const parsedBody = resolutionSchema.safeParse(await req.json());
    if (!parsedBody.success) {
      return fail(parsedBody.error.errors[0]?.message ?? "Petición inválida", 400);
    }
    const { finalStatus, reason, evidence } = parsedBody.data;

    // Guard IDOR/URL cruzada: commentId debe pertenecer a reviewId del path.
    const existing = await getReviewWithComments(parsedReviewId.data, ownerId);
    if (!existing) return fail("Revisión no encontrada", 404);
    const belongs = existing.comments.some((c) => c.id === parsedCommentId.data);
    if (!belongs) return fail("Comentario no encontrado", 404);

    try {
      await resolveReviewComment(parsedCommentId.data, ownerId, { finalStatus, reason, evidence }, actor);
    } catch (err) {
      if (err instanceof ReviewNotFoundError) return fail(err.message, 404);
      if (err instanceof ReviewConflictError || err instanceof ReviewRuleError) return fail(err.message, 409);
      throw err;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[pixelforge/reviews/:reviewId/comments/:commentId/resolution POST]", err);
    return fail("Error inesperado", 500);
  }
}
