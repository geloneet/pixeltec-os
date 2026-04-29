const TELEGRAM_API = 'https://api.telegram.org';
const TIMEOUT_MS = 5000;

export interface TelegramSendResult {
  ok: boolean;
  messageId?: number;
  error?: string;
}

export async function sendTelegramMessage(opts: {
  token: string;
  chatId: string;
  text: string;
  parseMode?: 'MarkdownV2' | 'HTML';
}): Promise<TelegramSendResult> {
  const url = `${TELEGRAM_API}/bot${opts.token}/sendMessage`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: opts.chatId,
        text: opts.text,
        parse_mode: opts.parseMode ?? 'HTML',
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const data = await res.json();
    if (!data.ok) {
      return { ok: false, error: data.description ?? 'unknown_telegram_error' };
    }
    return { ok: true, messageId: data.result.message_id };
  } catch (err) {
    clearTimeout(timer);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'fetch_failed',
    };
  }
}
