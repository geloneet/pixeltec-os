import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { parseJsonBody, toInboxFailure } from "@/lib/whatsapp-inbox/errors";
import { fetchPixelbot } from "@/lib/whatsapp-inbox/pixelbot-client";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/whatsapp-inbox/examples/[id]/active",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  // El id es un entero de PixelBot. Validarlo aquí evita que un segmento
  // arbitrario reescriba la ruta interna solicitada: era el único sitio del
  // subsistema que interpolaba un parámetro sin codificar.
  if (!/^[1-9][0-9]*$/.test(id)) {
    return NextResponse.json({ error: "id debe ser un entero positivo" }, { status: 400 });
  }

  const parsed = await parseJsonBody<{ active?: unknown }>(req);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Cuerpo JSON inválido", code: "invalid_body" }, { status: 400 });
  }
  const { active } = parsed.value;
  if (typeof active !== "boolean") {
    return NextResponse.json({ error: "active debe ser booleano" }, { status: 400 });
  }

  try {
    const { data, status } = await fetchPixelbot(
      `/internal/examples/${encodeURIComponent(id)}/active`,
      { active },
      "POST"
    );
    return NextResponse.json(data, { status });
  } catch (error) {
    const failure = toInboxFailure(error, "No se pudo actualizar el ejemplo.");
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status });
  }
}
