import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { blogPosts } from '@/lib/blog-data';
import { BlogPostingStructuredData } from '@/components/seo/structured-data';
import BlogPostClient from './blog-post-client';
import BlogPostFirestoreClient from './blog-post-firestore-client';
import type { BlogPostSerialized } from '@/lib/blog/types';

export const dynamic = 'force-dynamic';

async function getFirestorePost(slug: string): Promise<BlogPostSerialized | null> {
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

  const firestorePost = await getFirestorePost(slug);
  if (firestorePost) {
    const title = firestorePost.seo.metaTitle || firestorePost.title;
    const description = firestorePost.seo.metaDescription || firestorePost.excerpt;
    const base = buildMetadata({
      path: `/blog/${firestorePost.slug}`,
      title,
      description,
      ogImage: firestorePost.coverImage ?? undefined,
    });
    return {
      ...base,
      robots: firestorePost.seo.noindex ? 'noindex' : undefined,
      authors: [{ name: firestorePost.author.name }],
      openGraph: {
        ...base.openGraph,
        type: 'article',
        publishedTime: firestorePost.publishedAt ?? firestorePost.createdAt,
        authors: [firestorePost.author.name],
        images: firestorePost.coverImage
          ? [{ url: firestorePost.coverImage, width: 1200, height: 630, alt: title }]
          : base.openGraph?.images,
      },
    };
  }

  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) return { title: 'Artículo no encontrado' };

  const imageUrl = PlaceHolderImages.find((img) => img.id === post.imageId)?.imageUrl ?? '';
  const base = buildMetadata({
    path: `/blog/${post.slug}`,
    title: post.title,
    description: post.excerpt,
    ogImage: imageUrl || undefined,
  });
  return {
    ...base,
    authors: [{ name: post.author }],
    openGraph: {
      ...base.openGraph,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const firestorePost = await getFirestorePost(slug);
  if (firestorePost) {
    return (
      <>
        <BlogPostingStructuredData
          slug={firestorePost.slug}
          title={firestorePost.title}
          excerpt={firestorePost.excerpt}
          datePublished={firestorePost.publishedAt ?? firestorePost.createdAt}
          author={firestorePost.author.name}
          imageUrl={firestorePost.coverImage ?? ''}
        />
        <BlogPostFirestoreClient post={firestorePost} />
      </>
    );
  }

  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) notFound();

  const imageUrl = PlaceHolderImages.find((img) => img.id === post.imageId)?.imageUrl ?? '';
  return (
    <>
      <BlogPostingStructuredData
        slug={post.slug}
        title={post.title}
        excerpt={post.excerpt}
        datePublished={post.date}
        author={post.author}
        imageUrl={imageUrl}
      />
      <BlogPostClient post={post} />
    </>
  );
}
