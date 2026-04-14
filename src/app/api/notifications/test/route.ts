import { NextRequest, NextResponse } from "next/server";
import { sendWhatsApp } from "@/lib/twilio";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendWhatsApp(
    "✅ *PixelTEC CRM* - Test de notificación exitoso.\n\nTu sistema de recordatorios está activo."
  );

  return NextResponse.json(result);
}
