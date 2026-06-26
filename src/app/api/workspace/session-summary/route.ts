import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { WorkSession } from "@/types/session";

const client = new Anthropic();

interface RequestBody {
  session: WorkSession;
  elapsed?: number;
}

interface SummaryResponse {
  summary: string;
  bitacoraEntry: string;
  nextStep: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: RequestBody = await req.json();
    const { session } = body;

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
      ? session.blockers.map((b) => `- [${b.status}][${b.impact}] ${b.description}`).join("\n")
      : "Sin bloqueos";

    const durationMin = body.elapsed != null
      ? Math.round(body.elapsed / 60)
      : session.durationSeconds != null
      ? Math.round(session.durationSeconds / 60)
      : "desconocida";

    const prompt = `Eres el asistente de un desarrollador freelance. Al final de una sesión de trabajo generaste el siguiente registro:

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

    const message = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("AI response did not contain valid JSON");
    }
    const parsed: SummaryResponse = JSON.parse(jsonMatch[0]);

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[session-summary]", err);
    return NextResponse.json(
      { summary: "", bitacoraEntry: "", nextStep: "", error: "Error generando resumen" },
      { status: 500 }
    );
  }
}
