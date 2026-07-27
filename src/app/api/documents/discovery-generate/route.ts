import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { anthropicCreate } from "@/lib/ai/anthropic-egress";
import { parseModelJson } from "@/lib/ai/model-json";
import { requireSession } from "@/lib/vpsClient";

interface RequestBody {
  industry: string;
  clientName?: string;
}

interface GeneratedQuestions {
  questions: Array<{
    id: string;
    text: string;
    category: string;
    required: boolean;
    type: "text" | "select" | "multiselect";
    options?: string[];
  }>;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("__session")?.value ?? "";
    const session = await requireSession(sessionCookie);
    if (!session.ok) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body: RequestBody = await req.json();
    const { industry, clientName } = body;

    if (!industry) {
      return NextResponse.json({ error: "industry required" }, { status: 400 });
    }

    // El prompt nombra industria y cliente: se arma dentro de la fábrica
    // diferida, después de que la guarda autorice.
    const message = await anthropicCreate({
      operation: "generate_text",
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
      buildParams: () => ({
        max_tokens: 2000,
        messages: [{ role: "user" as const, content: buildPrompt(industry, clientName) }],
      }),
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const parsed = parseModelJson<GeneratedQuestions>(text);

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[discovery-generate]", err);
    return NextResponse.json({ error: "Error generando cuestionario" }, { status: 500 });
  }
}

function buildPrompt(industry: string, clientName?: string): string {
  return `Eres un consultor digital experto en onboarding de clientes. Genera un cuestionario de descubrimiento para un cliente de tipo: ${industry}${clientName ? ` (cliente: ${clientName})` : ""}.

Incluye 15-20 preguntas distribuidas en estas categorías: Negocio, Presencia digital, Objetivos, Audiencia, Pain points, Presupuesto, Timeline.

Reglas:
- type "text": preguntas abiertas
- type "select": cuando hay opciones mutuamente excluyentes (include "options" array con 3-6 opciones)
- type "multiselect": cuando se pueden elegir múltiples opciones (include "options" array)
- required: true para preguntas críticas de negocio
- id: formato "q_01", "q_02", ...

Responde SOLO con JSON válido:
{"questions":[{"id":"q_01","text":"...","category":"Negocio","required":true,"type":"text"},...]}`;
}
