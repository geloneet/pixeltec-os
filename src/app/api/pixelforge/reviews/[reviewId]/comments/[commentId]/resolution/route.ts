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
 * Mismo molde que `qa/runs/[qaRunId]/decision/route.ts`: auth → 401; zod →
 * 400; not found → 404; `ReviewConflictError` (CAS perdido) → 409 con el
 * mensaje del repo.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import {
  getReviewWithComments,
  resolveReviewComment,
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
      if (err instanceof ReviewConflictError) return fail(err.message, 409);
      const message = err instanceof Error ? err.message : "No se pudo resolver el comentario";
      if (message === "Comentario no encontrado") return fail(message, 404);
      return fail(message, 409);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[pixelforge/reviews/:reviewId/comments/:commentId/resolution POST]", err);
    return fail("Error inesperado", 500);
  }
}
