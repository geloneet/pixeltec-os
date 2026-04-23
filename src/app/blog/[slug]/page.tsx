import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import BlogPostClient from './blog-post-client';
import { blogPosts, type Post } from '@/lib/blog-data';
import { BlogPostingStructuredData } from '@/components/seo/structured-data';

function getPostBySlug(slug: string): Post | undefined {
  return blogPosts.find(p => p.slug === slug);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return {
      title: 'Artículo no encontrado',
    };
  }

  const description = post.excerpt;

  return {
    title: post.title,
    description: description,
    openGraph: {
      title: post.title,
      description: description,
      images: [
        {
          url: PlaceHolderImages.find(img => img.id === post.imageId)?.imageUrl || '',
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
  };
}

export async function generateStaticParams() {
  return blogPosts.map((post) => ({
    slug: post.slug,
  }));
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const imageUrl = PlaceHolderImages.find(img => img.id === post.imageId)?.imageUrl ?? '';

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
