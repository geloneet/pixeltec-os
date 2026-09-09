import { NextRequest, NextResponse } from "next/server";
import { geminiGenerateText } from "@/lib/ai/gemini-egress";
import { AiProviderError } from "@/lib/ai/errors";
import { parseModelJson, ModelResponseFormatError } from "@/lib/ai/model-json";
import { getSessionUserId } from "@/lib/auth/session";

// WO-2026-00254: "conversación" para editar el brief que ya generó
// /api/documents/brief-generate — Miguel pidió poder agregarle o quitarle
// cosas antes de convencerse y guardarlo. Cada turno reescribe el brief
// COMPLETO (decisión tomada con Miguel vía AskUserQuestion: más simple y
// predecible que un chat con historial acumulado) — el cliente solo manda el
// brief actual + la instrucción nueva; no hace falta que este endpoint
// recuerde turnos anteriores, porque el brief actual ya los refleja todos.
// Mismo contrato de salida que brief-generate: {solution, deliverables, benefits}.

interface CurrentBrief {
  solution: string;
  deliverables: string;
  benefits: string;
}

interface RequestBody {
  clientName: string;
  problem: string;
  currentBrief: CurrentBrief;
  instruction: string;
}

const MODEL = "gemini-3.5-flash-lite";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body: RequestBody = await req.json();
    if (!body.instruction?.trim()) {
      return NextResponse.json({ error: "instruction es requerido" }, { status: 400 });
    }
    if (!body.currentBrief?.solution?.trim()) {
      return NextResponse.json({ error: "currentBrief es requerido" }, { status: 400 });
    }

    const text = await geminiGenerateText({
      operation: "generate_text",
      model: MODEL,
      buildParams: () => ({
        prompt: buildPrompt(body),
        maxOutputTokens: 700,
        temperature: 0.3,
      }),
    });

    const parsed = parseModelJson<CurrentBrief>(text);
    return NextResponse.json(parsed);
  } catch (err) {
    if (err instanceof AiProviderError) {
      const status = err.code === "ai_not_configured" ? 503 : 502;
      return NextResponse.json(
        { solution: "", deliverables: "", benefits: "", error: safeAiErrorMessage(err.code) },
        { status },
      );
    }
    if (err instanceof ModelResponseFormatError) {
      return NextResponse.json(
        { solution: "", deliverables: "", benefits: "", error: "Gemini no devolvió un formato válido" },
        { status: 502 },
      );
    }
    console.error("[brief-refine]", err);
    return NextResponse.json(
      { solution: "", deliverables: "", benefits: "", error: "Error actualizando el brief" },
      { status: 500 },
    );
  }
}

function safeAiErrorMessage(code: string): string {
  if (code === "ai_not_configured") return "Gemini no está configurado (falta GEMINI_API_KEY)";
  return "El proveedor de IA no respondió correctamente";
}

function buildPrompt({ clientName, problem, currentBrief, instruction }: RequestBody): string {
  return `Eres un consultor digital que edita propuestas comerciales de PixelTEC (desarrollo web y apps) para clientes reales.

CLIENTE: ${clientName}
PROBLEMA A RESOLVER: ${problem}

BRIEF ACTUAL (ya aprobado hasta ahora por el vendedor, en este mismo formato):
- solution: ${currentBrief.solution}
- deliverables: ${currentBrief.deliverables}
- benefits: ${currentBrief.benefits}

INSTRUCCIÓN DEL VENDEDOR (aplícala tal cual, sin inventar cambios adicionales que no pidió):
${instruction}

Devuelve el brief COMPLETO ya actualizado con la instrucción aplicada — no un fragmento, no un
resumen del cambio. Todo lo que el brief actual decía y la instrucción no menciona se conserva
igual. Mismos tres campos, mismo criterio que el brief actual:

1. "solution": Párrafo de 2-3 oraciones.
2. "deliverables": Lista de entregables concretos, uno por línea con "- " al inicio.
3. "benefits": Párrafo de 2-3 oraciones sobre los beneficios clave para el cliente.

Responde SOLO con JSON válido, sin texto fuera del JSON:
{"solution":"...","deliverables":"...","benefits":"..."}`;
}
