/**
 * POST /api/pixelforge/reviews/:reviewId/comments — agrega un comentario a
 * una revisión ABIERTA (`addReviewComment`, T3). El ancla (`anchorType`) se
 * valida en forma cerrada acá (superRefine): `section` exige `nodeId` y
 * prohíbe `findingId`; `finding` exige `findingId` y prohíbe `nodeId`;
 * `general` prohíbe ambos — el repo revalida server-side (existencia del
 * nodo/finding, ownership del finding al `qa_run` anclado) bajo lock, esto
 * solo evita un roundtrip inútil con anclas obviamente mal formadas.
 *
 * Mismo molde que `qa/runs/route.ts` (L114-117): mapeo por `instanceof` —
 * `ReviewNotFoundError` ("Revisión no encontrada") → 404; `ReviewRuleError`
 * (ancla inválida, revisión no abierta) → 409 con el mensaje del repo;
 * cualquier otro error se re-lanza al catch global → 500 "Error inesperado"
 * sin exponer su mensaje (PF-F9 T4 fix).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { addReviewComment, ReviewNotFoundError, ReviewRuleError, type Actor } from "@/lib/db/repos/pixelforge";

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

const reviewIdSchema = z.string().uuid("Revisión inválida");

const commentBodySchema = z
  .object({
    anchorType: z.enum(["general", "section", "finding"], {
      errorMap: () => ({ message: "Tipo de ancla inválido" }),
    }),
    nodeId: z.string().optional(),
    findingId: z.string().uuid("Finding inválido").optional(),
    body: z
      .string()
      .min(1, "El comentario no puede estar vacío")
      .max(2000, "El comentario es demasiado largo (máximo 2000 caracteres)"),
    blocking: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.anchorType === "section") {
      if (!data.nodeId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El comentario de sección requiere nodeId", path: ["nodeId"] });
      }
      if (data.findingId != null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El comentario de sección no puede llevar findingId", path: ["findingId"] });
      }
    } else if (data.anchorType === "finding") {
      if (!data.findingId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El comentario de finding requiere findingId", path: ["findingId"] });
      }
      if (data.nodeId != null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El comentario de finding no puede llevar nodeId", path: ["nodeId"] });
      }
    } else {
      if (data.nodeId != null || data.findingId != null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Un comentario general no puede llevar nodeId ni findingId", path: ["anchorType"] });
      }
    }
  });

export async function POST(req: NextRequest, { params }: { params: Promise<{ reviewId: string }> }) {
  try {
    const session = await auth();
    const ownerId = session?.user?.id;
    if (!ownerId) return fail("No autenticado", 401);
    const actor: Actor = {
      id: ownerId,
      name: session.user?.name ?? session.user?.email ?? "Usuario",
    };

    const { reviewId } = await params;
    const parsedId = reviewIdSchema.safeParse(reviewId);
    if (!parsedId.success) {
      return fail(parsedId.error.errors[0]?.message ?? "Petición inválida", 400);
    }

    const parsedBody = commentBodySchema.safeParse(await req.json());
    if (!parsedBody.success) {
      return fail(parsedBody.error.errors[0]?.message ?? "Petición inválida", 400);
    }
    const { anchorType, nodeId, findingId, body, blocking } = parsedBody.data;

    let comment;
    try {
      comment = await addReviewComment(
        parsedId.data,
        ownerId,
        { anchorType, nodeId, findingId, body, blocking },
        actor
      );
    } catch (err) {
      if (err instanceof ReviewNotFoundError) return fail(err.message, 404);
      if (err instanceof ReviewRuleError) return fail(err.message, 409);
      throw err;
    }

    return NextResponse.json({ ok: true, comment });
  } catch (err) {
    console.error("[pixelforge/reviews/:reviewId/comments POST]", err);
    return fail("Error inesperado", 500);
  }
}
