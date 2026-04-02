import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import BlogPostClient from './blog-post-client';
import { blogPosts, type Post } from '@/lib/blog-data';

function getPostBySlug(slug: string): Post | undefined {
  return blogPosts.find(p => p.slug === slug);
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = getPostBySlug(params.slug);

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

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = getPostBySlug(params.slug);

  if (!post) {
    notFound();
  }

  return <BlogPostClient post={post} />;
}
