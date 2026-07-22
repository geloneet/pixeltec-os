/**
 * POST /api/pixelforge/qa/runs/:qaRunId/decision — decisión humana sobre un
 * QA `succeeded` con `verdict='pass_with_warnings'` (aprobar con reservas o
 * rechazar). `recordQaHumanDecision` (T1) ya valida la elegibilidad (debe
 * estar `succeeded`+`pass_with_warnings`+sin decisión previa) y lanza con
 * mensaje es-MX si no aplica — este handler lo mapea a 409.
 *
 * Guard EXTRA de esta ruta (no lo cubre T1): la `page_version` que evaluó
 * este QA debe seguir siendo la VIGENTE del proyecto — si el proyecto ya
 * compuso una versión más nueva mientras el QA esperaba decisión humana,
 * aprobar/rechazar sobre una versión vieja ya no tiene sentido (la landing
 * real que se publicaría es otra). 409 con mensaje es-MX si no coincide.
 *
 * Si `decision==='approved'`, abre la compuerta hacia `revision`
 * (`openQaGate`) — mismo mecanismo que usa `finalizeQaRunOrchestrated` para
 * un veredicto `pass` directo. Si `decision==='rejected'`, NO se abre
 * (el proyecto se queda en `qa`, a la espera de una nueva corrida).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import {
  getQaRunWithFindings,
  getLatestPageVersion,
  recordQaHumanDecision,
  openQaGate,
  type Actor,
} from "@/lib/db/repos/pixelforge";

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

const qaRunIdSchema = z.string().uuid("QA inválido");

const decisionSchema = z.object({
  decision: z.enum(["approved", "rejected"], {
    errorMap: () => ({ message: "Decisión inválida" }),
  }),
  reason: z.string().trim().min(5, "La razón debe tener al menos 5 caracteres"),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ qaRunId: string }> }) {
  try {
    const session = await auth();
    const ownerId = session?.user?.id;
    if (!ownerId) return fail("No autenticado", 401);
    const actor: Actor = {
      id: ownerId,
      name: session.user?.name ?? session.user?.email ?? "Usuario",
    };

    const { qaRunId } = await params;
    const parsedId = qaRunIdSchema.safeParse(qaRunId);
    if (!parsedId.success) {
      return fail(parsedId.error.errors[0]?.message ?? "Petición inválida", 400);
    }

    const parsedBody = decisionSchema.safeParse(await req.json());
    if (!parsedBody.success) {
      return fail(parsedBody.error.errors[0]?.message ?? "Petición inválida", 400);
    }
    const { decision, reason } = parsedBody.data;

    const existing = await getQaRunWithFindings(parsedId.data, ownerId);
    if (!existing) return fail("QA no encontrado", 404);

    const latest = await getLatestPageVersion(existing.run.projectId, ownerId);
    if (!latest || latest.id !== existing.run.pageVersionId) {
      return fail("El QA aprobado corresponde a una versión anterior; re-ejecuta QA", 409);
    }

    try {
      await recordQaHumanDecision(parsedId.data, ownerId, decision, reason, actor);
    } catch (err) {
      return fail(err instanceof Error ? err.message : "No se pudo registrar la decisión", 409);
    }

    if (decision === "approved") {
      await openQaGate(existing.run.projectId, parsedId.data, actor);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[pixelforge/qa/runs/:qaRunId/decision POST]", err);
    return fail("Error inesperado", 500);
  }
}
