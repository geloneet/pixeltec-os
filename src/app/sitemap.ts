import type { MetadataRoute } from "next";
import { getPublishedPosts } from "@/lib/blog/queries/posts";

const BASE_URL = "https://pixeltec.mx";

const servicesSlugs = ["ecosistemas-web", "automatizacion", "consultoria"];

export const revalidate = 3600;

async function getBlogRoutes(): Promise<MetadataRoute.Sitemap> {
  try {
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
    { url: `${BASE_URL}/blog`,                      lastModified: new Date('2026-06-16'), changeFrequency: "weekly",  priority: 0.8 },
    { url: `${BASE_URL}/industrias`,                lastModified: new Date('2026-06-16'), changeFrequency: "monthly", priority: 0.7 },
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

  const blogRoutes = await getBlogRoutes();

  return [...staticRoutes, ...serviceRoutes, ...blogRoutes];
}
