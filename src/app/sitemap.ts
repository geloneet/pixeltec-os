import type { MetadataRoute } from "next";
import { getPublishedPosts } from "@/lib/blog/queries/posts";
import { publishDueScheduledPosts } from "@/lib/blog-cms/queries";
import { SITE } from "@/lib/site-config";
import { getFlag } from "@/lib/settings/queries";
import { SETTING_SITEMAP_ENABLED } from "@/lib/seo/keys";

const BASE_URL = SITE.url;

const servicesSlugs = ["ecosistemas-web", "automatizacion", "consultoria"];

// force-dynamic: el sitemap DEBE consultar la DB en cada request. Con ISR, el
// XML se horneaba durante `docker build` (sin DATABASE_URL): getBlogRoutes()
// devolvía [] y ese artefacto vacío quedaba cacheado en producción — los
// artículos publicados jamás aparecían. La query es barata y el sitemap se
// pide poco; no vale el riesgo de volver a servir un horneado sin posts.
export const dynamic = 'force-dynamic';

async function getBlogRoutes(): Promise<MetadataRoute.Sitemap> {
  try {
    // Paridad Encino (WO-2026-00088): los programados vencidos entran al sitemap.
    await publishDueScheduledPosts().catch(() => []);
    const posts = await getPublishedPosts();
    return posts.map((post) => ({
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt ?? post.publishedAt ?? post.createdAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));
  } catch (error) {
    console.error("[sitemap] getPublishedPosts failed:", error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL,                                lastModified: new Date('2026-06-16'), changeFrequency: "weekly",  priority: 1.0 },
    { url: `${BASE_URL}/services`,                  lastModified: new Date('2026-06-16'), changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/pixelbot`,                  lastModified: new Date('2026-08-04'), changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/blog`,                      lastModified: new Date('2026-06-16'), changeFrequency: "weekly",  priority: 0.8 },
    { url: `${BASE_URL}/industrias`,                lastModified: new Date('2026-06-16'), changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/diagnostico`,               lastModified: new Date('2026-07-09'), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/about`,                     lastModified: new Date('2026-06-16'), changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/equipo`,                    lastModified: new Date('2026-06-16'), changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/contact`,                   lastModified: new Date('2026-06-16'), changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/metodologia`,               lastModified: new Date('2026-06-16'), changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/guias-transformacion`,      lastModified: new Date('2026-06-16'), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/aviso-de-privacidad`,       lastModified: new Date('2026-04-01'), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE_URL}/terminos-de-servicio`,      lastModified: new Date('2026-04-01'), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE_URL}/data-deletion`,             lastModified: new Date('2026-04-01'), changeFrequency: "yearly",  priority: 0.2 },
  ];

  const serviceRoutes: MetadataRoute.Sitemap = servicesSlugs.map((slug) => ({
    url: `${BASE_URL}/services/${slug}`,
    lastModified: new Date('2026-06-16'),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  // Interruptor del módulo SEO (WO-2026-00095, paridad Encino): apagado ⇒ solo
  // la portada. Ausente ⇒ ENCENDIDO, que es lo que PixelTEC OS ya servía antes
  // de existir el módulo: portarlo no puede apagarle el sitemap al sitio.
  const enabled = await getFlag(SETTING_SITEMAP_ENABLED, true).catch(() => true);
  if (!enabled) return [staticRoutes[0]];

  const blogRoutes = await getBlogRoutes();

  return [...staticRoutes, ...serviceRoutes, ...blogRoutes];
}
