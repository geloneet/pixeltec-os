/**
 * Google Maps embed (WO-2026-00088, paridad Encino `src/lib/blog-html.ts`):
 * acepta una URL suelta o un <iframe> pegado, extrae su `src` y solo lo
 * devuelve si es un embed oficial de Google Maps. Cualquier otra cosa ⇒ null
 * (jamás se guarda un iframe arbitrario).
 */
const MAPS_EMBED_RE = /^https:\/\/(www\.)?google\.[a-z.]{2,10}\/maps\/embed/i;

export function extractMapsEmbedUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  let candidate = raw;
  const srcMatch = raw.match(/src\s*=\s*["']([^"']+)["']/i);
  if (srcMatch) candidate = srcMatch[1].trim();
  return MAPS_EMBED_RE.test(candidate) ? candidate : null;
}
