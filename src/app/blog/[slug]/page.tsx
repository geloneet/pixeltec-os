import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { BlogPostingStructuredData, BreadcrumbStructuredData } from '@/components/seo/structured-data';
import BlogPostFirestoreClient from './blog-post-firestore-client';
import type { BlogPostSerialized } from '@/lib/blog/types';

export const revalidate = 86400; // ISR: regenerar máximo cada día

// Fallback absoluto para JSON-LD y OG cuando el post no tiene coverImage:
// un `image: ""` invalida el rich result de BlogPosting en Google.
const DEFAULT_POST_IMAGE = 'https://pixeltec.mx/og-image.png';

async function getPost(slug: string): Promise<BlogPostSerialized | null> {
  try {
    const { getPublishedPostBySlug } = await import('@/lib/blog/queries/posts');
    return await getPublishedPostBySlug(slug);
  } catch (error) {
    console.error('[blog/slug] getPublishedPostBySlug failed:', error);
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
  });
  return {
    ...base,
    robots: post.seo.noindex ? 'noindex' : undefined,
    authors: [{ name: post.author.name }],
    openGraph: {
      ...base.openGraph,
      type: 'article',
      publishedTime: post.publishedAt ?? post.createdAt,
      authors: [post.author.name],
      images: post.coverImage
        ? [{ url: post.coverImage, width: 1200, height: 630, alt: title }]
        : base.openGraph?.images,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const post = await getPost(slug);
  if (!post) notFound();

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
        dateModified={post.updatedAt ?? post.publishedAt ?? post.createdAt}
        author={post.author.name}
        imageUrl={post.coverImage || DEFAULT_POST_IMAGE}
      />
      <BlogPostFirestoreClient post={post} />
    </>
  );
}
