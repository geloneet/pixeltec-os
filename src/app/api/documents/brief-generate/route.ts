import { NextRequest, NextResponse } from "next/server";
import { geminiGenerateText } from "@/lib/ai/gemini-egress";
import { AiProviderError } from "@/lib/ai/errors";
import { parseModelJson, ModelResponseFormatError } from "@/lib/ai/model-json";
import { getSessionUserId } from "@/lib/auth/session";

// WO-2026-00222: genera el contenido de un "proposal" (brief de propuesta)
// a partir de los datos que ya tiene la cotización — problem/solution son los
// mismos "Problema a resolver"/"Solución propuesta" del form de Cotizaciones.
// Contrato de salida IDÉNTICO a /api/documents/proposal-generate (que usa
// Claude): {solution, deliverables, benefits}. Solo cambia el proveedor
// (Gemini, más barato) y que aquí SÍ recibimos la solución que el usuario
// ya escribió, en vez de pedirle a la IA que la invente desde cero.

interface RequestBody {
  clientName: string;
  problem: string;
  solution: string;
  scopeIncluded?: string;
  budget?: string;
  timeline?: string;
}

interface GeneratedBrief {
  solution: string;
  deliverables: string;
  benefits: string;
}

const MODEL = "gemini-2.0-flash-lite";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body: RequestBody = await req.json();
    if (!body.problem?.trim() || !body.solution?.trim()) {
      return NextResponse.json({ error: "problem y solution son requeridos" }, { status: 400 });
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

    const parsed = parseModelJson<GeneratedBrief>(text);
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
    console.error("[brief-generate]", err);
    return NextResponse.json(
      { solution: "", deliverables: "", benefits: "", error: "Error generando el brief" },
      { status: 500 },
    );
  }
}

function safeAiErrorMessage(code: string): string {
  if (code === "ai_not_configured") return "Gemini no está configurado (falta GEMINI_API_KEY)";
  return "El proveedor de IA no respondió correctamente";
}

function buildPrompt({ clientName, problem, solution, scopeIncluded, budget, timeline }: RequestBody): string {
  return `Eres un consultor digital que redacta propuestas comerciales de PixelTEC (desarrollo web y apps) para clientes reales.

CLIENTE: ${clientName}
PROBLEMA A RESOLVER (tal cual lo escribió el vendedor): ${problem}
SOLUCIÓN PROPUESTA (tal cual la escribió el vendedor): ${solution}
${scopeIncluded ? `ALCANCE INCLUIDO: ${scopeIncluded}` : ""}
${timeline ? `TIEMPO ESTIMADO: ${timeline}` : ""}
${budget ? `INVERSIÓN APROXIMADA: ${budget}` : ""}

Amplía esto en una propuesta comercial profesional, en español, directa y convincente,
sin inventar alcance que no esté implícito en lo anterior. Responde con estos tres campos:

1. "solution": Párrafo de 2-3 oraciones que desarrolla la solución propuesta (parte de lo
   que ya escribió el vendedor, no lo contradigas).
2. "deliverables": Lista de 4-6 entregables concretos derivados del alcance, uno por línea
   con "- " al inicio.
3. "benefits": Párrafo de 2-3 oraciones sobre los beneficios clave para el cliente.

Responde SOLO con JSON válido, sin texto fuera del JSON:
{"solution":"...","deliverables":"...","benefits":"..."}`;
}
