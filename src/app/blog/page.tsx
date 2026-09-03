import Link from "next/link";
import { formatEditorialDate } from "@/lib/blog/format-date";
import { BlogGrid, type BlogCardData } from "./blog-grid";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { CollectionPageStructuredData, BreadcrumbStructuredData } from "@/components/seo/structured-data";
import { SITE } from "@/lib/site-config";
import { BlogSidebar } from "@/components/blog/blog-sidebar";

export const revalidate = 3600; // ISR: regenerar máximo cada hora

// WO-2026-00213: título/H1 genéricos ("Insights & Tecnología") no explicaban
// a Google ni al usuario qué encontrarían — propuesta de Miguel reemplaza
// marca por intención de búsqueda real (PyMEs, IA, software, automatización).
const BLOG_INDEX_TITLE = 'Blog de tecnología para PyMEs | IA, software y automatización';
const BLOG_INDEX_DESCRIPTION = 'Guías, comparativas, calculadoras y casos reales sobre automatización con IA, software a medida y desarrollo de aplicaciones en México.';

export const metadata: Metadata = buildMetadata({
  path: '/blog',
  title: BLOG_INDEX_TITLE,
  description: BLOG_INDEX_DESCRIPTION,
});

/** Paridad Encino (WO-2026-00088): filtros por query `?categoria=` / `?etiqueta=`
 *  (en memoria sobre los publicados; sin páginas públicas por categoría/tag). */
interface PublicFilters {
  categoria: string;
  etiqueta: string;
}

interface PublishedIndex {
  cards: BlogCardData[];
  categories: string[];
  tags: string[];
  recentPosts: { slug: string; title: string }[];
}

async function getPublishedCards(filters: PublicFilters): Promise<PublishedIndex> {
  try {
    const { getPublishedPosts, getBlogSidebarData } = await import("@/lib/blog/queries/posts");
    // Barrido de programados (paridad Encino): un post `scheduled` vencido se
    // publica en la siguiente regeneración ISR de esta página.
    const { publishDueScheduledPosts } = await import("@/lib/blog-cms/queries");
    await publishDueScheduledPosts().catch(() => []);
    const all = await getPublishedPosts();
    const categories = Array.from(new Set(all.map((p) => p.category).filter(Boolean))).sort();
    const tags = Array.from(new Set(all.flatMap((p) => p.tags).filter(Boolean))).slice(0, 20);
    const posts = all.filter(
      (p) =>
        (!filters.categoria || p.category === filters.categoria) &&
        (!filters.etiqueta || p.tags.includes(filters.etiqueta)),
    );
    const cards = posts.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      category: p.category,
      // Portada local por defecto: mismo criterio que /blog/[slug] — un
      // placeholder externo (placehold.co) mete un tercer origen en la ruta
      // crítica del LCP del listado.
      imageUrl: p.coverImage ?? "/og-image.png",
      date: formatEditorialDate(p.publishedAt),
      readTime: `${p.readingTimeMin} min de lectura`,
      author: p.author.name,
      authorInitials: p.author.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase(),
      role: "PixelTEC Team",
    }));
    // WO-2026-00212: sidebar (Entradas recientes/Categorías/Etiquetas) —
    // recentPosts SIEMPRE sobre lo publicado sin filtrar (paridad Encino: la
    // barra no cambia cuando el listado se filtra por categoría/etiqueta).
    const { recentPosts } = await getBlogSidebarData();
    return { cards, categories, tags, recentPosts };
  } catch (error) {
    console.error('[blog/list] getPublishedCards failed:', error);
    return { cards: [], categories: [], tags: [], recentPosts: [] };
  }
}

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.slice(0, 80) ?? "";
}

export default async function BlogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const filters: PublicFilters = { categoria: one(sp.categoria), etiqueta: one(sp.etiqueta) };
  const { cards: posts, categories, tags, recentPosts } = await getPublishedCards(filters);
  const activeFilter = filters.categoria || filters.etiqueta;

  return (
    <>
      <CollectionPageStructuredData
        name={BLOG_INDEX_TITLE}
        description={BLOG_INDEX_DESCRIPTION}
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
              Tecnología práctica para empresas que quieren crecer
            </h1>
            <p className="text-lg md:text-xl text-zinc-400 max-w-3xl leading-relaxed">
              {BLOG_INDEX_DESCRIPTION}
            </p>
          </header>

          {(categories.length > 0 || tags.length > 0) && (
            <nav aria-label="Filtrar artículos" className="mb-10 flex flex-wrap items-center gap-2 text-sm">
              {activeFilter && (
                <Link href="/blog" className="rounded-full border border-white/20 px-3 py-1 text-zinc-300 hover:text-white">
                  ✕ {filters.categoria ? `Categoría: ${filters.categoria}` : `Etiqueta: ${filters.etiqueta}`}
                </Link>
              )}
              {categories.map((c) => (
                <Link key={`c-${c}`} href={`/blog?categoria=${encodeURIComponent(c)}`} className={`rounded-full px-3 py-1 ${filters.categoria === c ? "bg-brand-blue text-black" : "bg-blue-950/30 text-brand-blue hover:bg-blue-950/60"}`}>
                  {c}
                </Link>
              ))}
              {tags.map((t) => (
                <Link key={`t-${t}`} href={`/blog?etiqueta=${encodeURIComponent(t)}`} className={`rounded-full px-3 py-1 ${filters.etiqueta === t ? "bg-white text-black" : "border border-white/10 text-zinc-400 hover:text-white"}`}>
                  #{t}
                </Link>
              ))}
            </nav>
          )}

          <div className="lg:grid lg:grid-cols-[1fr_280px] lg:items-start lg:gap-12">
            <section aria-labelledby="blog-posts-heading">
              <h2 id="blog-posts-heading" className="sr-only">Blog Posts</h2>
              <BlogGrid posts={posts} />
            </section>
            <div className="hidden lg:block">
              <BlogSidebar
                recentPosts={recentPosts}
                categories={categories}
                tags={tags}
                activeCategory={filters.categoria || null}
                activeTag={filters.etiqueta || null}
              />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
