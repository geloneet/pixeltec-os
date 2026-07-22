/**
 * POST /api/pixelforge/reviews — abre una revisión humana (F9) sobre la
 * versión vigente de un proyecto, si el gate de QA está abierto para ella
 * (`openReview`, T3). GET — lista las revisiones del proyecto
 * (`listReviewsForProject`, T3), orden desc por `roundNumber`.
 *
 * Mismo molde que `src/app/api/pixelforge/qa/runs/route.ts` (L114-117): mapeo
 * por `instanceof` — `ReviewNotFoundError` → 404; `ReviewRuleError`/
 * `ReviewConflictError` → 409 con su mensaje es-ES; CUALQUIER OTRO error
 * (Postgres crudo, conexión caída, etc.) NO se mapea acá — se re-lanza y cae
 * al catch global de la función, que responde 500 "Error inesperado" SIN
 * exponer el mensaje interno al navegador (PF-F9 T4 fix, Important del
 * review: el fallback anterior por mensaje devolvía 409 + `err.message` para
 * cualquier `Error` no reconocido). A diferencia de `qa/runs/route.ts` (que
 * hace el chequeo de ownership por separado antes de listar), acá tanto
 * `openReview` como `listReviewsForProject` YA validan ownership internamente
 * y lanzan `ReviewNotFoundError("Proyecto no encontrado")` ellos mismos — el
 * handler solo mapea esa clase a 404, sin una consulta extra.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import {
  openReview,
  listReviewsForProject,
  ReviewNotFoundError,
  ReviewRuleError,
  ReviewConflictError,
  type Actor,
} from "@/lib/db/repos/pixelforge";

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

/**
 * Mapeo por `instanceof` — nunca por mensaje. Cualquier error no reconocido
 * (ni `ReviewNotFoundError` ni `ReviewRuleError`/`ReviewConflictError`) se
 * re-lanza para que lo atrape el catch global → 500 genérico, sin filtrar su
 * mensaje interno al cliente.
 */
function failFromError(err: unknown): NextResponse {
  if (err instanceof ReviewNotFoundError) return fail(err.message, 404);
  if (err instanceof ReviewRuleError || err instanceof ReviewConflictError) return fail(err.message, 409);
  throw err;
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
      return failFromError(err);
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
      return failFromError(err);
    }

    return NextResponse.json({ reviews });
  } catch (err) {
    console.error("[pixelforge/reviews GET]", err);
    return fail("Error inesperado", 500);
  }
}
