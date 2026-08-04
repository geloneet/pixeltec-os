'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, CalendarDays, RefreshCw } from 'lucide-react';
import type { PublicBlogPost } from '@/lib/blog/public-post';
import type { HeadingEntry } from '@/lib/blog/heading-utils';

const MarkdownRenderer = dynamic(() => import('@/components/blog/markdown-renderer'));

// Portada local por defecto: el placeholder externo (placehold.co) metía un
// tercer origen en la ruta crítica del LCP y era el "cover" de posts reales.
const DEFAULT_COVER = '/og-image.png';

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

interface RelatedCard {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
}

export default function BlogPostClient({
  post,
  related,
  headings,
}: {
  post: PublicBlogPost;
  related: RelatedCard[];
  headings: HeadingEntry[];
}) {
  const coverImage = post.coverImage ?? DEFAULT_COVER;
  const coverAlt = post.coverAlt || post.title;
  const publishedStr = fmtDate(post.publishedAt);
  const updatedStr =
    post.lastReviewedAt && post.lastReviewedAt !== post.publishedAt
      ? fmtDate(post.lastReviewedAt)
      : null;
  const readTime = `${post.readingTimeMin} min de lectura`;
  // El DTO público ya trae SOLO fuentes verificadas (frontera P1-A).
  const verifiedSources = post.sources;

  return (
    <main className="min-h-screen bg-[#030303] text-white pt-32 sm:pt-40 pb-16 sm:pb-24">
      <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 md:mb-10">
          <Link
            href="/blog"
            className="group inline-flex items-center font-medium text-zinc-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="mr-2 h-5 w-5 transition-transform group-hover:-translate-x-1" />
            Volver al Blog
          </Link>
        </div>

        <header className="relative mb-12 h-64 sm:h-80 md:h-96 w-full overflow-hidden rounded-2xl md:rounded-3xl shadow-[0_0_30px_rgba(0,240,255,0.05)]">
          <Image src={coverImage} alt={coverAlt} fill className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          <div className="absolute bottom-0 left-0 w-full p-6 md:p-8 lg:p-12">
            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="rounded-full bg-cyan-950/50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-blue">
                {post.category}
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-300">
                <CalendarDays className="h-4 w-4" aria-hidden />
                {publishedStr} • {readTime}
              </span>
              {updatedStr && (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-400">
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Actualizado el {updatedStr}
                </span>
              )}
            </div>
            <h1 className="text-3xl font-extrabold leading-tight text-white md:text-4xl lg:text-5xl">
              {post.title}
            </h1>
          </div>
        </header>

        {headings.length >= 3 && (
          <nav
            aria-label="Tabla de contenidos"
            className="mb-10 rounded-xl border border-white/10 bg-white/[0.03] p-5"
          >
            <p className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-400">En este artículo</p>
            <ol className="space-y-1.5 text-sm">
              {headings.map((h) => (
                <li key={h.id} className={h.depth === 3 ? 'pl-4' : ''}>
                  <a href={`#${h.id}`} className="text-zinc-300 transition-colors hover:text-brand-blue">
                    {h.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <article className="prose prose-invert prose-lg max-w-none text-zinc-300">
          <MarkdownRenderer content={post.body} />
        </article>

        {verifiedSources.length > 0 && (
          <section aria-labelledby="fuentes-heading" className="mt-14 rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <h2 id="fuentes-heading" className="mb-4 text-lg font-bold text-white">
              Fuentes y referencias
            </h2>
            <ol className="space-y-3 text-sm">
              {verifiedSources.map((s) => (
                <li key={s.url} className="text-zinc-400">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-400 underline underline-offset-4 hover:text-blue-300"
                  >
                    {s.title}
                  </a>
                  {s.publisher && <span> — {s.publisher}</span>}
                  {s.accessedAt && <span className="text-zinc-600"> (consultado: {s.accessedAt.slice(0, 10)})</span>}
                </li>
              ))}
            </ol>
          </section>
        )}

        <footer className="mt-14 border-t border-white/10 pt-8">
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
            <div>
              <p className="text-zinc-500">Escrito por</p>
              <Link href="/equipo" className="font-semibold text-zinc-200 transition-colors hover:text-brand-blue">
                {post.authorName}
              </Link>
              <p className="text-zinc-500">Equipo PixelTEC · Puerto Vallarta, México</p>
            </div>
            <span className="text-zinc-500">{publishedStr}</span>
          </div>

          <div className="mt-10 rounded-2xl border border-cyan-500/20 bg-cyan-950/20 p-6 md:p-8">
            <h2 className="text-xl font-bold text-white md:text-2xl">
              ¿Quieres aplicar esto en tu empresa?
            </h2>
            <p className="mt-2 max-w-2xl text-zinc-400">
              Diagnosticamos tu operación y te decimos, sin humo, qué automatizar primero y qué retorno esperar.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/diagnostico"
                className="inline-flex items-center rounded-lg bg-cyan-500 px-5 py-2.5 font-semibold text-black transition-colors hover:bg-cyan-400"
              >
                Hacer el diagnóstico
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center rounded-lg border border-white/20 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-white/10"
              >
                Hablar con el equipo
              </Link>
            </div>
          </div>

          {related.length > 0 && (
            <section aria-labelledby="related-heading" className="mt-12">
              <h2 id="related-heading" className="mb-5 text-xl font-bold text-white">
                Sigue leyendo
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/blog/${r.slug}`}
                    className="group rounded-xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-cyan-500/40"
                  >
                    <span className="text-xs font-bold uppercase tracking-wide text-brand-blue">{r.category}</span>
                    <h3 className="mt-2 font-semibold text-zinc-100 group-hover:text-white">{r.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm text-zinc-500">{r.excerpt}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </footer>
      </div>
    </main>
  );
}
