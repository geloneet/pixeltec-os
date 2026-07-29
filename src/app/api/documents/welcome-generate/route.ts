import { NextRequest, NextResponse } from "next/server";
import { anthropicCreate } from "@/lib/ai/anthropic-egress";
import { getSessionUserId } from "@/lib/auth/session";

interface RequestBody {
  clientName: string;
  serviceDescription: string;
  contactName?: string;
  startDate?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body: RequestBody = await req.json();
    const { clientName, serviceDescription } = body;

    if (!clientName?.trim() || !serviceDescription?.trim()) {
      return NextResponse.json({ error: "clientName and serviceDescription are required" }, { status: 400 });
    }

    // El prompt nombra al cliente y su servicio contratado: se arma dentro de
    // la fábrica diferida, después de que la guarda autorice.
    const message = await anthropicCreate({
      operation: "generate_text",
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
      buildParams: () => ({
        max_tokens: 400,
        messages: [{ role: "user" as const, content: buildPrompt(body) }],
      }),
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text.trim() : "";

    return NextResponse.json({ content: text });
  } catch (err) {
    console.error("[welcome-generate]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

function buildPrompt({ clientName, serviceDescription, contactName, startDate }: RequestBody): string {
  const contactLine = contactName ? `Persona de contacto: ${contactName}.` : "";
  const dateLine = startDate ? `Fecha de inicio: ${startDate}.` : "";

  return `Eres el equipo de PixelTEC, una agencia digital profesional.
Escribe un mensaje de bienvenida cálido y profesional en español para un cliente nuevo.

Cliente: ${clientName}
Servicio contratado: ${serviceDescription}
${contactLine}
${dateLine}

El mensaje debe:
- Dar la bienvenida al cliente por su nombre
- Confirmar brevemente el servicio contratado
- Explicar qué sucederá en las próximas 24–48 horas (contacto del equipo, kickoff, etc.)
- Invitar a preguntas y enfatizar disponibilidad
- Sonar humano, entusiasta pero profesional
- Tener entre 120 y 180 palabras
- NO incluir saludo genérico inicial ("Estimado/a") — empezar directo con "¡Bienvenido/a..."

Escribe solo el cuerpo del mensaje, sin asunto ni firma.`;
}
