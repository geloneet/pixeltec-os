import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { anthropicCreate } from "@/lib/ai/anthropic-egress";
import { parseModelJson } from "@/lib/ai/model-json";
import { requireSession } from "@/lib/vpsClient";
import type { WorkSession } from "@/types/session";

interface RequestBody {
  session: WorkSession;
  elapsed?: number;
}

interface SummaryResponse {
  summary: string;
  bitacoraEntry: string;
  nextStep: string;
}

/**
 * Arma el prompt con el contenido de la sesión. Se invoca DENTRO de la fábrica
 * diferida de `anthropicCreate`: si la política de egress bloquea, este texto
 * —que lleva proyecto, tarea, notas y bloqueos reales— nunca llega a existir.
 */
function buildPrompt(session: WorkSession, elapsed?: number): string {
  const activitiesText = session.activities
    .filter((a) => a.completedAt)
    .map((a) => `- ${a.description}`)
    .join("\n") || "Sin actividades registradas";

  const goalsText = (session.sessionGoals ?? [])
    .map(g => `${g.completed ? "✓" : "☐"} ${g.text}`)
    .join("\n") || "Sin objetivos definidos";

  const observationsText = session.notes.length > 0
    ? session.notes.map(n => `[${n.type}] ${n.content}`).join("\n")
    : "Sin observaciones";

  const blockersText = session.blockers.length > 0
    ? session.blockers.map((b) => `- [${b.status}][${b.impact}][${b.source}] ${b.description}`).join("\n")
    : "Sin bloqueos";

  const durationMin = elapsed != null
    ? Math.round(elapsed / 60)
    : session.durationSeconds != null
    ? Math.round(session.durationSeconds / 60)
    : "desconocida";

  return `Eres el asistente de un desarrollador freelance. Al final de una sesión de trabajo generaste el siguiente registro:

PROYECTO: ${session.projectName}
TAREA: ${session.taskName}
DURACIÓN: ${durationMin} minutos

OBJETIVOS:
${goalsText}

ACTIVIDADES COMPLETADAS:
${activitiesText}

OBSERVACIONES:
${observationsText}

BLOQUEOS:
${blockersText}

DEPLOY: ${session.deployStatus === "yes" ? "Sí" : session.deployStatus === "no" ? "No" : "No aplica"}
COMMIT: ${session.commitStatus ? "Sí" : "No"}

Con esta información:
1. Escribe un "summary" en 2-3 oraciones que resuma qué se logró en la sesión (español, profesional).
2. Escribe una "bitacoraEntry" lista para pegar en la bitácora del proyecto: una entrada concisa (3-5 líneas) en primera persona, sin encabezado, que documente el trabajo realizado, resultados y próximos pasos. Formato: texto plano, sin markdown.
3. Escribe un "nextStep" — la recomendación más concreta para la siguiente sesión (1 oración).

Responde SOLO con JSON válido en este formato exacto:
{"summary":"...","bitacoraEntry":"...","nextStep":"..."}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("__session")?.value ?? "";
    const authSession = await requireSession(sessionCookie);
    if (!authSession.ok) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body: RequestBody = await req.json();
    const { session } = body;

    const message = await anthropicCreate({
      operation: "analyze",
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
      buildParams: () => ({
        max_tokens: 600,
        messages: [{ role: "user", content: buildPrompt(session, body.elapsed) }],
      }),
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const parsed = parseModelJson<SummaryResponse>(text);

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[session-summary]", err);
    return NextResponse.json(
      { summary: "", bitacoraEntry: "", nextStep: "", error: "Error generando resumen" },
      { status: 500 }
    );
  }
}
