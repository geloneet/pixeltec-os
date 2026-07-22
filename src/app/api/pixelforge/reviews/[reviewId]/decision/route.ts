/**
 * POST /api/pixelforge/reviews/:reviewId/decision — decisión de cierre sobre
 * una revisión ABIERTA: aprobar (`approveReview`), pedir cambios
 * (`requestChanges`) o cancelar (`cancelReview`) — las tres funciones T3,
 * `db.transaction` + lock de proyecto + **CAS** sobre `status='in_review'`.
 * El body se discrimina por `action` (`z.discriminatedUnion`).
 *
 * Mismo molde que `qa/runs/[qaRunId]/decision/route.ts`: auth → 401; zod →
 * 400 (incluye `action` desconocida); "Revisión no encontrada" → 404;
 * `ReviewConflictError` (CAS perdido) y cualquier otro error de negocio
 * (gate/hash/versión/riesgos/bloqueantes/contentTarget faltante) → 409 con
 * el mensaje del repo. Sin `revalidatePath` tras la decisión — el cliente
 * hace `router.refresh()` (mismo patrón que QA).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import {
  approveReview,
  requestChanges,
  cancelReview,
  ReviewConflictError,
  type Actor,
} from "@/lib/db/repos/pixelforge";

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

const NOT_FOUND_MESSAGES = new Set(["Revisión no encontrada"]);

function failFromError(err: unknown, fallback: string) {
  if (err instanceof ReviewConflictError) return fail(err.message, 409);
  const message = err instanceof Error ? err.message : fallback;
  return fail(message, NOT_FOUND_MESSAGES.has(message) ? 404 : 409);
}

const reviewIdSchema = z.string().uuid("Revisión inválida");

const riskSchema = z.object({
  findingId: z.string().uuid("Finding inválido"),
  rationale: z.string().min(5, "La justificación del riesgo debe tener al menos 5 caracteres"),
});

const approveSchema = z.object({
  action: z.literal("approve"),
  reason: z.string().min(5, "La razón debe tener al menos 5 caracteres"),
  risks: z.array(riskSchema).default([]),
});

const requestChangesSchema = z.object({
  action: z.literal("request_changes"),
  changeKind: z.enum(
    ["contenido", "direccion_visual", "estructura", "composicion", "defecto_tecnico", "defecto_registry"],
    { errorMap: () => ({ message: "Tipo de cambio inválido" }) }
  ),
  contentTarget: z.enum(["contexto", "estrategia", "blueprint"]).optional(),
  reason: z.string().min(5, "La razón debe tener al menos 5 caracteres"),
});

const cancelSchema = z.object({
  action: z.literal("cancel"),
  reason: z.string().min(5, "La razón debe tener al menos 5 caracteres"),
});

const decisionBodySchema = z.discriminatedUnion("action", [approveSchema, requestChangesSchema, cancelSchema]);

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

    const parsedBody = decisionBodySchema.safeParse(await req.json());
    if (!parsedBody.success) {
      return fail(parsedBody.error.errors[0]?.message ?? "Petición inválida", 400);
    }
    const input = parsedBody.data;

    try {
      if (input.action === "approve") {
        await approveReview(parsedId.data, ownerId, { reason: input.reason, risks: input.risks }, actor);
      } else if (input.action === "request_changes") {
        await requestChanges(
          parsedId.data,
          ownerId,
          { changeKind: input.changeKind, contentTarget: input.contentTarget, reason: input.reason },
          actor
        );
      } else {
        await cancelReview(parsedId.data, ownerId, input.reason, actor);
      }
    } catch (err) {
      return failFromError(err, "No se pudo completar la decisión");
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[pixelforge/reviews/:reviewId/decision POST]", err);
    return fail("Error inesperado", 500);
  }
}
