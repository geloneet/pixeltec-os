"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

export interface BlogCardData {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  imageUrl: string;
  date: string;
  readTime: string;
  author: string;
  authorInitials: string;
  role: string;
}

export function BlogGrid({ posts }: { posts: BlogCardData[] }) {
  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-zinc-400 text-lg mb-2">Contenido en construcción</p>
        <p className="text-zinc-600 text-sm max-w-md">
          Estamos preparando artículos técnicos de calidad. Vuelve pronto.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {posts.map((post, index) => (
        <motion.article
          key={post.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: index * 0.1 }}
          className="group relative bg-[#0A0A0A] border border-white/5 rounded-2xl md:rounded-3xl overflow-hidden hover:border-brand-blue/50 hover:-translate-y-1 transition-all duration-300 flex flex-col shadow-[0_0_30px_rgba(0,0,0,0.5)]"
        >
          <div className="h-48 w-full relative overflow-hidden">
            <Image
              src={post.imageUrl}
              alt={post.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              data-ai-hint="technology"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] to-transparent z-10" />
          </div>

          <div className="p-6 md:p-8 flex flex-col flex-grow">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-blue-950/30 text-brand-blue text-xs px-3 py-1 rounded-full font-semibold">
                {post.category}
              </span>
              <span className="text-zinc-500 text-xs font-medium">
                {post.date} • {post.readTime}
              </span>
            </div>

            <h3 className="text-xl font-bold text-white mb-3 group-hover:text-brand-blue transition-colors">
              <Link href={`/blog/${post.slug}`}>
                <span className="absolute inset-0" aria-hidden="true" />
                {post.title}
              </Link>
            </h3>

            <p className="text-zinc-400 text-sm mb-6 flex-grow leading-relaxed">
              {post.excerpt}
            </p>

            <footer className="flex items-center justify-between mt-auto pt-6 border-t border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-950 flex items-center justify-center text-brand-blue text-xs font-bold">
                  {post.authorInitials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-none mb-1">{post.author}</p>
                  <p className="text-xs text-zinc-500 leading-none">{post.role}</p>
                </div>
              </div>
              <div className="flex items-center text-sm font-bold text-brand-blue group-hover:text-blue-400">
                Leer <ArrowRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </footer>
          </div>
        </motion.article>
      ))}
    </div>
  );
}
