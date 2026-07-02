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
  body?: Record<string, unknown>,
  method: 'POST' | 'GET' | 'PUT' = 'POST'
): Promise<{ data: unknown; status: number }> {
  const baseUrl = process.env.PIXELBOT_INTERNAL_URL;
  const secret = process.env.PIXELBOT_INTERNAL_SECRET;

  if (!baseUrl || !secret) {
    throw new Error('PIXELBOT_INTERNAL_URL / PIXELBOT_INTERNAL_SECRET no configurados');
  }

  const headers: Record<string, string> = {
    'X-Internal-Secret': secret,
  };

  const fetchOptions: RequestInit = {
    method,
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  };

  // GET requests don't include body or Content-Type
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify(body || {});
  }

  const res = await fetch(`${baseUrl}${path}`, fetchOptions);

  const data = await res.json().catch(() => ({}));
  return { data, status: res.status };
}
