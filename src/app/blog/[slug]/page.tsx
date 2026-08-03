import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { absoluteUrl } from '@/lib/site-config';
import { BlogPostingStructuredData, BreadcrumbStructuredData } from '@/components/seo/structured-data';
import BlogPostClient from './blog-post-client';
import { extractHeadings } from '@/lib/blog/heading-utils';
import type { BlogPostSerialized } from '@/lib/blog/types';

export const revalidate = 86400; // ISR: regenerar máximo cada día

// Fallback absoluto para JSON-LD y OG cuando el post no tiene coverImage:
// un `image: ""` invalida el rich result de BlogPosting en Google.
const DEFAULT_POST_IMAGE = absoluteUrl('/og-image.png');

async function getPost(slug: string): Promise<BlogPostSerialized | null> {
  try {
    const { getPublishedPostBySlug } = await import('@/lib/blog/queries/posts');
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

  const { getRelatedPosts } = await import('@/lib/blog/queries/posts');
  const related = await getRelatedPosts(post.slug, post.category).catch(() => []);
  const headings = extractHeadings(post.body);

  const imageUrl = post.coverImage ? absoluteUrl(post.coverImage) : DEFAULT_POST_IMAGE;

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
      <BlogPostClient
        post={post}
        headings={headings}
        related={related.map((r) => ({ slug: r.slug, title: r.title, excerpt: r.excerpt, category: r.category }))}
      />
    </>
  );
}
