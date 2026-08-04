import { assertEgressAllowed } from "@/lib/egress-guard";

/**
 * Única puerta hacia la API de Unsplash (búsqueda de portadas del blog).
 * Canal OPCIONAL del contrato de egress: sin `EGRESS_UNSPLASH_MODE=live` el
 * guard bloquea; sin `UNSPLASH_ACCESS_KEY` se lanza error de configuración.
 * Host FIJO (api.unsplash.com) — la query viaja como parámetro codificado:
 * no hay superficie SSRF. Solo lectura de un catálogo público.
 */

export interface UnsplashPhoto {
  id: string;
  /** URL para el grid del selector (≈400px). */
  thumbUrl: string;
  /** URL para usar como portada (≈1080px, hotlink oficial de Unsplash). */
  regularUrl: string;
  /** Descripción de la foto — candidata a alt de portada. */
  altDescription: string;
  authorName: string;
  authorLink: string;
}

const API_BASE = "https://api.unsplash.com";

export async function searchUnsplashPhotos(query: string, page = 1): Promise<UnsplashPhoto[]> {
  assertEgressAllowed({ channel: "unsplash", operation: "search_photos", target: "api.unsplash.com" });

  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    throw new Error("unsplash_not_configured");
  }

  const url = new URL(`${API_BASE}/search/photos`);
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "12");
  url.searchParams.set("page", String(Math.max(1, Math.min(page, 5))));
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("content_filter", "high");

  const res = await fetch(url, {
    headers: {
      Authorization: `Client-ID ${accessKey}`,
      "Accept-Version": "v1",
    },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });

  if (!res.ok) {
    // Nunca propagar el cuerpo del proveedor (misma disciplina que la IA).
    throw new Error(`unsplash_http_${res.status}`);
  }

  const data = (await res.json()) as {
    results?: Array<{
      id?: string;
      description?: string | null;
      alt_description?: string | null;
      urls?: { small?: string; regular?: string };
      user?: { name?: string; links?: { html?: string } };
    }>;
  };

  return (data.results ?? [])
    .filter((r) => r?.id && r.urls?.small && r.urls?.regular)
    .map((r) => ({
      id: r.id as string,
      thumbUrl: r.urls!.small as string,
      regularUrl: r.urls!.regular as string,
      altDescription: (r.description || r.alt_description || "").trim(),
      authorName: r.user?.name ?? "Unsplash",
      authorLink: r.user?.links?.html ?? "https://unsplash.com",
    }));
}
