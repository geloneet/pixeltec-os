import Header from "@/components/header";
import { Footer } from "@/components/ui/footer-section";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { blogPosts } from "@/lib/blog-data";
import { BlogGrid, type BlogCardData } from "./blog-grid";
import type { Metadata } from "next";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Blog · Insights y Tecnología",
  description: "Exploramos el futuro del desarrollo de software, la inteligencia artificial y la modernización empresarial.",
  alternates: { canonical: "/blog" },
};

async function getFirestorePosts(): Promise<BlogCardData[]> {
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
    console.error('[blog/list] getFirestorePosts failed:', error);
    return [];
  }
}

function getStaticPosts(): BlogCardData[] {
  return blogPosts.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    category: p.category,
    imageUrl:
      PlaceHolderImages.find((img) => img.id === p.imageId)?.imageUrl ??
      "https://placehold.co/1200x630/0a0a0a/ffffff?text=PIXELTEC",
    date: p.date,
    readTime: p.readTime,
    author: p.author,
    authorInitials: p.author.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase(),
    role: p.role,
  }));
}

export default async function BlogPage() {
  const firestorePosts = await getFirestorePosts();
  // Fall back to static posts until Firestore has published content
  const posts = firestorePosts.length > 0 ? firestorePosts : getStaticPosts();

  return (
    <>
      <Header />
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
      <Footer />
    </>
  );
}
