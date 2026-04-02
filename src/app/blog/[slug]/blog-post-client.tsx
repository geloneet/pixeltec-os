'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import type { Post } from '@/lib/blog-data';

const getImageUrl = (id: string) => {
  return PlaceHolderImages.find(img => img.id === id)?.imageUrl || 'https://placehold.co/1200x600/png';
};

export default function BlogPostClient({ post }: { post: Post }) {
  if (!post) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#030303] text-white p-4">
        <h1 className="text-3xl md:text-4xl font-bold text-center">Artículo no encontrado</h1>
        <Link href="/blog" className="mt-4 text-cyan-400 hover:underline">
          Volver al Blog
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#030303] text-white pt-32 sm:pt-40 pb-16 sm:pb-24">
      <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        
        {/* Back Navigation */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 md:mb-10"
        >
          <Link
            href="/blog"
            className="group inline-flex items-center font-medium text-zinc-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="mr-2 h-5 w-5 transition-transform group-hover:-translate-x-1" />
            Volver al Blog
          </Link>
        </motion.div>

        {/* Post Header */}
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative mb-12 h-64 sm:h-80 md:h-96 w-full overflow-hidden rounded-2xl md:rounded-3xl shadow-[0_0_30px_rgba(0,240,255,0.05)]"
        >
          <Image
            src={getImageUrl(post.imageId)}
            alt={post.title}
            fill
            className="object-cover"
            data-ai-hint={PlaceHolderImages.find(img => img.id === post.imageId)?.imageHint || 'image'}
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          <div className="absolute bottom-0 left-0 w-full p-6 md:p-8 lg:p-12">
            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="rounded-full bg-cyan-950/50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-blue">
                {post.category}
              </span>
              <span className="text-sm font-medium text-zinc-300">
                {post.date} • {post.readTime}
              </span>
            </div>
            <h1 className="text-3xl font-extrabold leading-tight text-white md:text-4xl lg:text-5xl">
              {post.title}
            </h1>
          </div>
        </motion.header>

        {/* Post Body */}
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="prose prose-invert prose-lg max-w-none space-y-6 text-base md:text-lg leading-relaxed text-zinc-300"
        >
          {post.content.split('\n\n').map((paragraph: string, index: number) => (
            <p key={index}>{paragraph}</p>
          ))}

          <h2 className="mt-12 mb-4 text-2xl md:text-3xl font-bold text-white">La visión de PixelTEC</h2>
          <p>
            La transformación digital requiere más que solo código; requiere una visión estratégica
            enfocada en resultados reales. Si tu empresa está lista para dar el siguiente salto, nuestro
            equipo está preparado para diseñar la arquitectura de tu futuro.
          </p>
        </motion.article>
      </div>
    </main>
  );
}
