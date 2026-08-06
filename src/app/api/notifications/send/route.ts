import { NextRequest, NextResponse } from "next/server";
import { sendWhatsApp } from "@/lib/whatsapp/sender";
import { assertCronExecutionAllowed, cronBlockedResponse } from "@/lib/cron-guard";
import { bearerToken, cronSecretMatches } from "@/lib/cron-secret";

export async function POST(req: NextRequest) {
  if (!cronSecretMatches(bearerToken(req.headers.get("authorization")))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Antes de leer el cuerpo y de cualquier envío.
  try {
    assertCronExecutionAllowed();
  } catch (err) {
    const blocked = cronBlockedResponse(err);
    if (blocked) return blocked;
    throw err;
  }

  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const result = await sendWhatsApp(message);
    return NextResponse.json(result);
  } catch (error) {
    // Igual que charges/daily: sin este log un fallo aquí era indiagnosticable.
    console.error("[notifications/send] failed:", error instanceof Error ? error.name : typeof error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
