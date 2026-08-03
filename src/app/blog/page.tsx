import { BlogGrid, type BlogCardData } from "./blog-grid";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { CollectionPageStructuredData, BreadcrumbStructuredData } from "@/components/seo/structured-data";
import { SITE } from "@/lib/site-config";

export const revalidate = 3600; // ISR: regenerar máximo cada hora

export const metadata: Metadata = buildMetadata({
  path: '/blog',
  title: 'Blog · Insights y Tecnología',
  description: 'Exploramos el futuro del desarrollo de software, la inteligencia artificial y la modernización empresarial.',
});

async function getPublishedCards(): Promise<BlogCardData[]> {
  try {
    const { getPublishedPosts } = await import("@/lib/blog/queries/posts");
    const posts = await getPublishedPosts();
    return posts.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      category: p.category,
      imageUrl: p.coverImage ?? "https://placehold.co/1200x630/0a0a0a/ffffff?text=PIXELTEC",
      date: p.publishedAt
        ? new Date(p.publishedAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
        : "",
      readTime: `${p.readingTimeMin} min de lectura`,
      author: p.author.name,
      authorInitials: p.author.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase(),
      role: "PixelTEC Team",
    }));
  } catch (error) {
    console.error('[blog/list] getPublishedCards failed:', error);
    return [];
  }
}

export default async function BlogPage() {
  const posts = await getPublishedCards();

  return (
    <>
      <CollectionPageStructuredData
        name="Blog · Insights y Tecnología"
        description="Exploramos el futuro del desarrollo de software, la inteligencia artificial y la modernización empresarial."
        path="/blog"
      />
      <BreadcrumbStructuredData items={[
        { name: SITE.name, url: SITE.url },
        { name: 'Blog', url: `${SITE.url}/blog` },
      ]} />
      {/* Header/Footer los monta blog/layout.tsx (compartidos con el detalle) */}
      <main className="min-h-screen bg-[#030303] text-white pt-32 sm:pt-40 pb-16 sm:pb-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <header className="mb-12 md:mb-16">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-4 tracking-tight">
              Insights &amp; Tecnología
            </h1>
            <p className="text-lg md:text-xl text-zinc-400 max-w-3xl leading-relaxed">
              Exploramos el futuro del desarrollo de software, la inteligencia artificial y la modernización empresarial.
            </p>
          </header>

          <section aria-labelledby="blog-posts-heading">
            <h2 id="blog-posts-heading" className="sr-only">Blog Posts</h2>
            <BlogGrid posts={posts} />
          </section>
        </div>
      </main>
    </>
  );
}
