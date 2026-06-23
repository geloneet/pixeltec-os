import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import { requireSession } from "@/lib/vpsClient";

const client = new Anthropic();

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

    const prompt = `Eres un consultor digital experto en onboarding de clientes. Genera un cuestionario de descubrimiento para un cliente de tipo: ${industry}${clientName ? ` (cliente: ${clientName})` : ""}.

Incluye 15-20 preguntas distribuidas en estas categorías: Negocio, Presencia digital, Objetivos, Audiencia, Pain points, Presupuesto, Timeline.

Reglas:
- type "text": preguntas abiertas
- type "select": cuando hay opciones mutuamente excluyentes (include "options" array con 3-6 opciones)
- type "multiselect": cuando se pueden elegir múltiples opciones (include "options" array)
- required: true para preguntas críticas de negocio
- id: formato "q_01", "q_02", ...

Responde SOLO con JSON válido:
{"questions":[{"id":"q_01","text":"...","category":"Negocio","required":true,"type":"text"},...]}`;

    const message = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI response had no JSON");
    const parsed: GeneratedQuestions = JSON.parse(jsonMatch[0]);

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[discovery-generate]", err);
    return NextResponse.json({ error: "Error generando cuestionario" }, { status: 500 });
  }
}
