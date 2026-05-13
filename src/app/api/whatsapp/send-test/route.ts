/**
 * POST /api/whatsapp/send-test
 *
 * Smoke-test endpoint for the Meta WhatsApp sender. Protected by
 * `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Body (all optional):
 *   { "message"?: string, "to"?: string }
 *
 *   - message: defaults to "Test desde PixelTEC OS — <iso>"
 *   - to:      defaults to META_WHATSAPP_TO; otherwise overrides it
 *
 * Responses:
 *   200 { ok: true,  messageId: "wamid....", to: "..." }
 *   401 { error: "Unauthorized" }
 *   500 { ok: false, error: "<descripción>" }
 */

import { NextRequest, NextResponse } from "next/server";
import { sendWhatsApp } from "@/lib/whatsapp/sender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TestBody {
  message?: unknown;
  to?: unknown;
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  if (!expected || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = (await request.json().catch(() => ({}))) as TestBody;
    const message =
      typeof parsed.message === "string" && parsed.message.trim() !== ""
        ? parsed.message
        : `Test desde PixelTEC OS — ${new Date().toISOString()}`;
    const to = typeof parsed.to === "string" && parsed.to.trim() !== "" ? parsed.to : undefined;

    const result = await sendWhatsApp(message, to ? { to } : undefined);

    return NextResponse.json({
      ok: true,
      messageId: result.messageId,
      to: result.to,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
