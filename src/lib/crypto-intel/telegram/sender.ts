// src/lib/crypto-intel/telegram/sender.ts
// Helper para enviar mensajes proactivos (ej: desde alert engine).
// Separado del bot.ts para evitar ciclos de dependencia en el webhook.

const TELEGRAM_API = "https://api.telegram.org";

export async function sendTelegramAlert(
  chatId: string | number,
  markdownMessage: string
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN no configurado");

  const url = `${TELEGRAM_API}/bot${token}/sendMessage`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: markdownMessage,
      parse_mode: "MarkdownV2",
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(
      `[telegram-sender] fallo enviando a ${chatId}: ${res.status} ${body}`
    );
    // No throw: no queremos que un fallo de envío tumbe el alert engine completo.
  }
}
