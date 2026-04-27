import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
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
    return {
      title: firestorePost.seo.metaTitle || firestorePost.title,
      description: firestorePost.seo.metaDescription || firestorePost.excerpt,
      robots: firestorePost.seo.noindex ? 'noindex' : undefined,
      alternates: { canonical: `/blog/${firestorePost.slug}` },
      openGraph: {
        title: firestorePost.seo.metaTitle || firestorePost.title,
        description: firestorePost.seo.metaDescription || firestorePost.excerpt,
        images: firestorePost.coverImage
          ? [{ url: firestorePost.coverImage, width: 1200, height: 630, alt: firestorePost.title }]
          : [],
      },
    };
  }

  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) return { title: 'Artículo no encontrado' };

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: [
        {
          url: PlaceHolderImages.find((img) => img.id === post.imageId)?.imageUrl || '',
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
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
