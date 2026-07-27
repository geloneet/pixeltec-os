import { NextRequest, NextResponse } from "next/server";
import { sendWhatsApp } from "@/lib/whatsapp/sender";
import { assertCronExecutionAllowed, cronBlockedResponse } from "@/lib/cron-guard";

export async function GET(req: NextRequest) {
  const provided = req.headers.get("authorization")?.replace("Bearer ", "") ?? req.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET || provided !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Tras autenticar y antes de cualquier efecto: quien no traiga el secreto
  // recibe 401 y no llega a saber si el cron está activo.
  try {
    assertCronExecutionAllowed();
  } catch (err) {
    const blocked = cronBlockedResponse(err);
    if (blocked) return blocked;
    throw err;
  }

  const result = await sendWhatsApp(
    "✅ *PixelTEC CRM* - Test de notificación exitoso.\n\nTu sistema de recordatorios está activo."
  );

  return NextResponse.json(result);
}
