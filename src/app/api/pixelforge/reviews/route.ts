/**
 * POST /api/pixelforge/reviews — abre una revisión humana (F9) sobre la
 * versión vigente de un proyecto, si el gate de QA está abierto para ella
 * (`openReview`, T3). GET — lista las revisiones del proyecto
 * (`listReviewsForProject`, T3), orden desc por `roundNumber`.
 *
 * Mismo molde que `src/app/api/pixelforge/qa/runs/[qaRunId]/decision/route.ts`:
 * auth → 401; zod → 400; errores de negocio del repo → 409 con su mensaje
 * es-ES; "Proyecto no encontrado" → 404; catch global → 500. A diferencia de
 * `qa/runs/route.ts` (que hace el chequeo de ownership por separado antes de
 * listar), acá tanto `openReview` como `listReviewsForProject` YA validan
 * ownership internamente y lanzan "Proyecto no encontrado" ellos mismos — el
 * handler solo mapea ese mensaje a 404 en el catch, sin una consulta extra.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { openReview, listReviewsForProject, type Actor } from "@/lib/db/repos/pixelforge";

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

const NOT_FOUND_MESSAGES = new Set(["Proyecto no encontrado"]);

function failFromError(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : fallback;
  return fail(message, NOT_FOUND_MESSAGES.has(message) ? 404 : 409);
}

const openReviewSchema = z.object({
  projectId: z.string().uuid("Proyecto inválido"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const ownerId = session?.user?.id;
    if (!ownerId) return fail("No autenticado", 401);
    const actor: Actor = {
      id: ownerId,
      name: session.user?.name ?? session.user?.email ?? "Usuario",
    };

    const parsed = openReviewSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(parsed.error.errors[0]?.message ?? "Petición inválida", 400);
    }
    const { projectId } = parsed.data;

    let review;
    try {
      review = await openReview(projectId, ownerId, actor);
    } catch (err) {
      return failFromError(err, "No se pudo abrir la revisión");
    }

    return NextResponse.json({ ok: true, review });
  } catch (err) {
    console.error("[pixelforge/reviews POST]", err);
    return fail("Error inesperado", 500);
  }
}

const listQuerySchema = z.string().uuid("Proyecto inválido");

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const ownerId = session?.user?.id;
    if (!ownerId) return fail("No autenticado", 401);

    const parsed = listQuerySchema.safeParse(req.nextUrl.searchParams.get("projectId"));
    if (!parsed.success) {
      return fail(parsed.error.errors[0]?.message ?? "Petición inválida", 400);
    }
    const projectId = parsed.data;

    let reviews;
    try {
      reviews = await listReviewsForProject(projectId, ownerId);
    } catch (err) {
      return failFromError(err, "No se pudieron listar las revisiones");
    }

    return NextResponse.json({ reviews });
  } catch (err) {
    console.error("[pixelforge/reviews GET]", err);
    return fail("Error inesperado", 500);
  }
}
