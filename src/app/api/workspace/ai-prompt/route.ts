import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import { requireSession } from "@/lib/vpsClient";
import type { WorkSession } from "@/types/session";

const client = new Anthropic();

type PromptKey = "resumen" | "commit" | "siguiente" | "riesgos" | "bitacora" | "libre";

interface RequestBody {
  session: WorkSession;
  elapsed?: number;
  promptKey: PromptKey;
  customPrompt?: string;
}

function buildContext(session: WorkSession, elapsed?: number): string {
  const durationMin = elapsed != null
    ? Math.round(elapsed / 60)
    : session.durationSeconds != null
    ? Math.round(session.durationSeconds / 60)
    : 0;

  const goals = (session.sessionGoals ?? [])
    .map(g => `${g.completed ? "✓" : "☐"} ${g.text}`)
    .join("\n") || "Sin objetivos definidos";

  const activities = session.activities
    .filter(a => a.completedAt)
    .map(a => `✓ ${a.description}`)
    .join("\n") || "Sin actividades completadas";

  const inProgress = session.activities.find(a => !a.completedAt);
  const currentActivity = inProgress ? `▶ ${inProgress.description} (en progreso)` : "Sin actividad en progreso";

  const observations = session.notes.length > 0
    ? session.notes.map(n => `[${n.type}] ${n.content}${n.markedForSummary ? " ★" : ""}`).join("\n")
    : "Sin observaciones";

  const blockers = session.blockers.length > 0
    ? session.blockers.map(b => `[${b.status}][${b.impact}][${b.source}] ${b.description}`).join("\n")
    : "Sin bloqueos";

  return `PROYECTO: ${session.projectName}
CLIENTE: ${session.clientName}
TAREA: ${session.taskName}
DURACIÓN: ${durationMin} minutos

OBJETIVOS:
${goals}

ACTIVIDAD ACTUAL:
${currentActivity}

ACTIVIDADES COMPLETADAS:
${activities}

OBSERVACIONES:
${observations}

BLOQUEOS:
${blockers}`;
}

const PROMPT_TEMPLATES: Record<PromptKey, (ctx: string, custom?: string) => string> = {
  resumen: (ctx) => `${ctx}

Eres el asistente de un desarrollador. Resume esta sesión de trabajo en 4-6 puntos concisos usando bullet points. Español. Sin encabezado.`,

  commit: (ctx) => `${ctx}

Eres el asistente de un desarrollador. Genera un mensaje de commit en inglés siguiendo Conventional Commits. Formato: tipo(alcance): descripción corta. Luego una línea en blanco y 2-3 líneas de contexto. Solo el mensaje, sin explicaciones.`,

  siguiente: (ctx) => `${ctx}

Eres el asistente de un desarrollador. Con base en esta sesión, ¿qué debería hacer a continuación? Responde con 3-5 pasos concretos, ordenados por prioridad. Bullet points. Español.`,

  riesgos: (ctx) => `${ctx}

Eres el asistente de un desarrollador. Analiza esta sesión y detecta riesgos antes de hacer deploy. Lista solo los riesgos reales y accionables. Bullet points. Si no hay riesgos evidentes, dilo claramente. Español.`,

  bitacora: (ctx) => `${ctx}

Eres el asistente de un desarrollador freelance. Redacta una entrada para la bitácora del proyecto. Primera persona, pasado, 3-5 oraciones, tono profesional. Incluye qué se hizo, qué se encontró y qué sigue. Sin encabezado. Solo el texto. Español.`,

  libre: (ctx, custom) => `${ctx}

${custom ?? "Resume la sesión."}`,
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("__session")?.value ?? "";
    const authSession = await requireSession(sessionCookie);
    if (!authSession.ok) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body: RequestBody = await req.json();
    const { session, elapsed, promptKey, customPrompt } = body;

    const ctx = buildContext(session, elapsed);
    const promptFn = PROMPT_TEMPLATES[promptKey] ?? PROMPT_TEMPLATES.libre;
    const prompt = promptFn(ctx, customPrompt);

    const message = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    return NextResponse.json({ text });
  } catch (err) {
    console.error("[ai-prompt]", err);
    return NextResponse.json({ text: "", error: "Error generando respuesta" }, { status: 500 });
  }
}
