// src/app/api/crypto-intel/telegram/webhook/route.ts
// Endpoint webhook. Telegram envía updates aquí cuando el usuario interactúa.
//
// SETUP:
// 1. Desplegar a producción
// 2. Configurar webhook ejecutando una vez:
//    curl -F "url=https://tu-dominio.com/api/crypto-intel/telegram/webhook" \
//         -F "secret_token=<TU_WEBHOOK_SECRET>" \
//         https://api.telegram.org/bot<TU_BOT_TOKEN>/setWebhook

// grammy está en serverExternalPackages — estos imports son ESM nativos,
// no se bundlean con webpack, por lo que webhookCallback y Bot llegan íntegros.
import { webhookCallback } from "grammy";
import { NextRequest, NextResponse } from "next/server";
import { ensureBotInit, getBot } from "@/lib/crypto-intel/telegram/bot";
import { log } from "@/lib/crypto-intel/logger";

export const runtime = "nodejs"; // grammY necesita Node runtime, no Edge
export const dynamic = "force-dynamic";

// handle se instancia la primera vez que llega un POST (lazy),
// evitando leer TELEGRAM_BOT_TOKEN en build time.
let handle: ((req: Request) => Promise<Response>) | null = null;

function getHandle(): (req: Request) => Promise<Response> {
  if (!handle) {
    handle = webhookCallback(getBot(), "std/http") as (req: Request) => Promise<Response>;
  }
  return handle;
}

export async function POST(req: NextRequest) {
  // Validación del secret token — Telegram lo manda en header
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const received = req.headers.get("x-telegram-bot-api-secret-token");

  if (expected && received !== expected) {
    console.warn("[webhook] secret token inválido");
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    await ensureBotInit();
    // Log webhook calls without awaiting to avoid slowing the webhook response
    req.clone().json().then((body: Record<string, unknown>) => {
      log("telegram-webhook", "info", "Update recibido", { updateId: body.update_id }).catch(() => {});
    }).catch(() => {});
    return await getHandle()(req);
  } catch (err) {
    console.error("[webhook] error procesando update", err);
    // Responder 200 siempre — Telegram no debe reintentar en loop
    return new Response("ok", { status: 200 });
  }
}
