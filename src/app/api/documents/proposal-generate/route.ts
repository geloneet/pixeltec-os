import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import { requireSession } from "@/lib/vpsClient";

const client = new Anthropic();

interface RequestBody {
  clientName: string;
  scope: string;
  budget?: string;
  timeline?: string;
}

interface GeneratedProposal {
  solution: string;
  deliverables: string;
  benefits: string;
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
    const { clientName, scope, budget, timeline } = body;

    const prompt = `Eres un consultor digital freelance que ayuda a redactar propuestas comerciales para clientes de desarrollo web y apps.

CLIENTE: ${clientName}
ALCANCE DEL PROYECTO: ${scope}
${budget ? `PRESUPUESTO APROXIMADO: ${budget}` : ""}
${timeline ? `TIMELINE: ${timeline}` : ""}

Genera una propuesta comercial profesional con los siguientes campos:

1. "solution": Párrafo de 2-3 oraciones describiendo la solución propuesta (español, directo, convincente).
2. "deliverables": Lista de 4-6 entregables concretos, uno por línea con "- " al inicio.
3. "benefits": Párrafo de 2-3 oraciones sobre los beneficios clave para el cliente.

Responde SOLO con JSON válido:
{"solution":"...","deliverables":"...","benefits":"..."}`;

    const message = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI response had no JSON");
    const parsed: GeneratedProposal = JSON.parse(jsonMatch[0]);

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[proposal-generate]", err);
    return NextResponse.json(
      { solution: "", deliverables: "", benefits: "", error: "Error generando propuesta" },
      { status: 500 },
    );
  }
}
