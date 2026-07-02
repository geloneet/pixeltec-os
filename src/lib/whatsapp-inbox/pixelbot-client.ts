/**
 * Cliente server-side hacia la API interna de PixelBot.
 *
 * PixelBot corre como container `pixelbot` en la red Docker `web-network`
 * (misma red que este app). En producción PIXELBOT_INTERNAL_URL es
 * http://pixelbot:3011; en dev local (el VPS mismo) http://127.0.0.1:3011.
 *
 * Solo usar desde API routes / server actions — el secret jamás llega al browser.
 */

export async function fetchPixelbot(
  path: string,
  body: Record<string, unknown>
): Promise<{ data: unknown; status: number }> {
  const baseUrl = process.env.PIXELBOT_INTERNAL_URL;
  const secret = process.env.PIXELBOT_INTERNAL_SECRET;

  if (!baseUrl || !secret) {
    throw new Error('PIXELBOT_INTERNAL_URL / PIXELBOT_INTERNAL_SECRET no configurados');
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': secret,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });

  const data = await res.json().catch(() => ({}));
  return { data, status: res.status };
}
