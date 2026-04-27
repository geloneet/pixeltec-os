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
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL,                           lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${BASE_URL}/about`,                lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/services`,             lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/blog`,                 lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
    { url: `${BASE_URL}/contact`,              lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/metodologia`,          lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/industrias`,           lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/equipo`,               lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  const serviceRoutes: MetadataRoute.Sitemap = servicesSlugs.map((slug) => ({
    url: `${BASE_URL}/services/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  const blogRoutes = await getBlogRoutes();

  return [...staticRoutes, ...serviceRoutes, ...blogRoutes];
}
