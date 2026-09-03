import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { absoluteUrl } from '@/lib/site-config';
import { BlogPostingStructuredData, BreadcrumbStructuredData, FAQPageStructuredData } from '@/components/seo/structured-data';
import { buildExtraSchemaNodes } from '@/lib/blog-cms/schema-types';
import BlogPostClient from './blog-post-client';
import { extractHeadings } from '@/lib/blog/heading-utils';
import { toPublicBlogPost } from '@/lib/blog/public-post';
import type { BlogPostSerialized } from '@/lib/blog/types';

export const revalidate = 86400; // ISR: regenerar máximo cada día

// Fallback absoluto para JSON-LD y OG cuando el post no tiene coverImage:
// un `image: ""` invalida el rich result de BlogPosting en Google.
const DEFAULT_POST_IMAGE = absoluteUrl('/og-image.png');

async function getPost(slug: string): Promise<BlogPostSerialized | null> {
  try {
    const { getPublishedPostBySlug } = await import('@/lib/blog/queries/posts');
    // Paridad Encino (WO-2026-00088): abrir el enlace de un post programado a
    // su hora lo publica en vez de responder 404.
    const { publishDueScheduledPosts } = await import('@/lib/blog-cms/queries');
    await publishDueScheduledPosts().catch(() => []);
    return await getPublishedPostBySlug(slug);
  } catch (error) {
    console.error('[blog/slug] getPublishedPostBySlug failed:', error);
    return null;
  }
}

/** Slug histórico → 308 al slug vigente (post_redirects, alimentada por
 *  changeSlug). Se consulta solo cuando el slug no resolvió un post. */
async function resolveRedirect(slug: string): Promise<string | null> {
  try {
    const { getRedirectTargetSlug } = await import('@/lib/blog/queries/posts');
    return await getRedirectTargetSlug(slug);
  } catch (error) {
    console.error('[blog/slug] getRedirectTargetSlug failed:', error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;

  const post = await getPost(slug);
  if (!post) return { title: 'Artículo no encontrado' };

  const title = post.seo.metaTitle || post.title;
  const description = post.seo.metaDescription || post.excerpt;
  const base = buildMetadata({
    path: `/blog/${post.slug}`,
    title,
    description,
    ogImage: post.coverImage ?? undefined,
    ogImageAlt: post.seo.ogImageAlt || undefined,
    noindex: post.seo.noindex,
    article: {
      publishedTime: post.publishedAt ?? post.createdAt,
      modifiedTime: post.editorial.lastReviewedAt ?? post.updatedAt,
      authors: [post.author.name],
    },
  });
  return {
    ...base,
    // Paridad Encino: `nofollow` por artículo (seo.nofollow); `noindex` sigue
    // significando «fuera del sitio público» (contrato legacy intacto).
    ...(post.seo.nofollow ? { robots: { index: !post.seo.noindex, follow: false } } : {}),
    authors: [{ name: post.author.name }],
    // El canonical editorial (seo.canonicalUrl) manda cuando existe — antes el
    // campo era un zombie que jamás llegaba al <head>.
    alternates: {
      canonical: post.seo.canonicalUrl ?? absoluteUrl(`/blog/${post.slug}`),
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const post = await getPost(slug);
  if (!post) {
    const target = await resolveRedirect(slug);
    if (target) permanentRedirect(`/blog/${target}`);
    notFound();
  }

  const { getRelatedPosts, getBlogSidebarData } = await import('@/lib/blog/queries/posts');
  const related = await getRelatedPosts(post.slug, post.category).catch(() => []);
  // WO-2026-00212: mismo sidebar del listado (Entradas recientes/Categorías/
  // Etiquetas), también en la entrada individual — pedido explícito de
  // Miguel. Excluye el post actual de "recientes" (no aplica en /blog, que
  // no tiene un "post actual").
  const sidebar = await getBlogSidebarData(post.slug).catch(() => ({ recentPosts: [], categories: [], tags: [] }));
  const headings = extractHeadings(post.body);

  const imageUrl = post.coverImage ? absoluteUrl(post.coverImage) : DEFAULT_POST_IMAGE;
  const publicPost = toPublicBlogPost(post);

  return (
    <>
      <BreadcrumbStructuredData items={[
        { name: 'PixelTEC', url: 'https://pixeltec.mx' },
        { name: 'Blog', url: 'https://pixeltec.mx/blog' },
        { name: post.title, url: `https://pixeltec.mx/blog/${post.slug}` },
      ]} />
      <BlogPostingStructuredData
        slug={post.slug}
        title={post.title}
        excerpt={post.excerpt}
        datePublished={post.publishedAt ?? post.createdAt}
        dateModified={post.editorial.lastReviewedAt ?? post.updatedAt ?? post.publishedAt ?? post.createdAt}
        author={post.author.name}
        imageUrl={imageUrl}
      />
      {/* Paridad Encino: FAQPage solo cuando hay FAQ visible (mismo texto). */}
      {publicPost.faq.length > 0 && <FAQPageStructuredData items={publicPost.faq.map((f) => ({ q: f.question, a: f.answer }))} />}
      {/* Tipos de rich snippet ADICIONALES elegidos en el editor (tab
          «Snippets», WO-2026-00088 FASE 11). Nodo mínimo por tipo, igual que el
          SchemaInjector de Encino pero resuelto en el servidor. */}
      {buildExtraSchemaNodes(post.seo.schemaTypes ?? [], {
        title: post.title,
        url: `https://pixeltec.mx/blog/${post.slug}`,
      }).map((node) => (
        <script
          key={node['@type']}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(node) }}
        />
      ))}
      {/* Frontera P1-A: al cliente cruza SOLO el DTO público (allowlist). */}
      <BlogPostClient
        post={publicPost}
        headings={headings}
        related={related.map((r) => ({ slug: r.slug, title: r.title, excerpt: r.excerpt, category: r.category }))}
        sidebar={sidebar}
      />
    </>
  );
}
