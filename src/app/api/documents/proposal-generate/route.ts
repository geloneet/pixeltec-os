import { NextRequest, NextResponse } from "next/server";
import { anthropicCreate } from "@/lib/ai/anthropic-egress";
import { parseModelJson } from "@/lib/ai/model-json";
import { getSessionUserId } from "@/lib/auth/session";

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
    const userId = await getSessionUserId();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body: RequestBody = await req.json();

    // El prompt lleva nombre de cliente, alcance y presupuesto reales: se arma
    // dentro de la fábrica diferida, después de que la guarda autorice.
    const message = await anthropicCreate({
      operation: "generate_text",
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
      buildParams: () => ({
        max_tokens: 600,
        messages: [{ role: "user" as const, content: buildPrompt(body) }],
      }),
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const parsed = parseModelJson<GeneratedProposal>(text);

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[proposal-generate]", err);
    return NextResponse.json(
      { solution: "", deliverables: "", benefits: "", error: "Error generando propuesta" },
      { status: 500 },
    );
  }
}

function buildPrompt({ clientName, scope, budget, timeline }: RequestBody): string {
  return `Eres un consultor digital freelance que ayuda a redactar propuestas comerciales para clientes de desarrollo web y apps.

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
}
