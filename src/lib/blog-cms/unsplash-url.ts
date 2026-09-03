/**
 * Valida una URL pegada a mano en el editor de blog como portada de Unsplash
 * (WO-2026-00198, AC-2). Solo acepta el link directo a la imagen (CDN de
 * Unsplash, el mismo dominio que ya usa `unsplash-egress.ts` para las URLs de
 * resultado de búsqueda) — nunca la página `unsplash.com/photos/<slug>`, que
 * es HTML y no sirve como `src` de una imagen. Es solo un `<img>` hotlink,
 * como ya hace el buscador: no hay descarga ni proxy, así que no hay
 * superficie SSRF nueva.
 */
const ALLOWED_HOSTS = new Set(["images.unsplash.com", "plus.unsplash.com"]);

export function parseUnsplashImageUrl(input: string): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Pega una URL de imagen de Unsplash." };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "Esa URL no es válida." };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "La URL debe ser https." };
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    if (parsed.hostname === "unsplash.com" || parsed.hostname.endsWith(".unsplash.com")) {
      return {
        ok: false,
        error: "Esa es la página de la foto, no la imagen. Ábrela, clic derecho → «Copiar dirección de imagen» y pega esa URL (images.unsplash.com/…).",
      };
    }
    return { ok: false, error: "Solo se aceptan URLs de imagen de Unsplash (images.unsplash.com)." };
  }

  return { ok: true, url: trimmed };
}
