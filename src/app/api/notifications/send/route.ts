import { NextRequest, NextResponse } from "next/server";
import { sendWhatsApp } from "@/lib/whatsapp/sender";
import { assertCronExecutionAllowed, cronBlockedResponse } from "@/lib/cron-guard";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  if (!expected || auth !== expected) {
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
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
