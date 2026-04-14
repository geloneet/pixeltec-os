import { NextRequest, NextResponse } from "next/server";
import { sendWhatsApp } from "@/lib/twilio";

export async function POST(req: NextRequest) {
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
