'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, CalendarDays, RefreshCw } from 'lucide-react';
import { formatEditorialDate } from '@/lib/blog/format-date';
import type { PublicBlogPost } from '@/lib/blog/public-post';
import type { HeadingEntry } from '@/lib/blog/heading-utils';
import { ViewBeacon } from '@/components/blog/view-beacon';
import { BlogSidebar } from '@/components/blog/blog-sidebar';
import { relatedResourcesFor } from '@/lib/blog/cluster-map';
import { GoogleBusinessCard } from '@/components/site/google-business-card';

const MarkdownRenderer = dynamic(() => import('@/components/blog/markdown-renderer'));

// Portada local por defecto: el placeholder externo (placehold.co) metía un
// tercer origen en la ruta crítica del LCP y era el "cover" de posts reales.
const DEFAULT_COVER = '/og-image.png';

interface RelatedCard {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
}

interface SidebarData {
  recentPosts: { slug: string; title: string }[];
  categories: string[];
  tags: string[];
}

export default function BlogPostClient({
  post,
  related,
  headings,
  sidebar,
}: {
  post: PublicBlogPost;
  related: RelatedCard[];
  headings: HeadingEntry[];
  sidebar: SidebarData;
}) {
  const coverImage = post.coverImage ?? DEFAULT_COVER;
  const coverAlt = post.coverAlt || post.title;
  const publishedStr = formatEditorialDate(post.publishedAt);
  const updatedStr =
    post.lastReviewedAt && post.lastReviewedAt !== post.publishedAt
      ? formatEditorialDate(post.lastReviewedAt)
      : null;
  const readTime = `${post.readingTimeMin} min de lectura`;
  // El DTO público ya trae SOLO fuentes verificadas (frontera P1-A).
  const verifiedSources = post.sources;
  // L3 (WO-2026-00345): si el editor no cargó `internalLinks`, el bloque de
  // recursos se rellena por cluster (categoría + etiquetas) para que todo
  // artículo enlace a un servicio y a una landing. Mismo `data-cta` para que
  // /seo/contenido lo mida igual.
  const resourceLinks =
    post.internalLinks.length > 0
      ? post.internalLinks
      : relatedResourcesFor(post.category, post.tags, post.internalLinks).map((r) => ({ targetUrl: r.href, anchor: r.anchor }));

  return (
    <main className="min-h-screen bg-background dark:bg-[#030303] text-foreground dark:text-white pt-32 sm:pt-40 pb-16 sm:pb-24">
      <ViewBeacon slug={post.slug} />
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 md:mb-10">
          <Link
            href="/blog"
            className="group inline-flex items-center font-medium text-muted-foreground dark:text-zinc-400 transition-colors hover:text-foreground dark:hover:text-white"
          >
            <ArrowLeft className="mr-2 h-5 w-5 transition-transform group-hover:-translate-x-1" />
            Volver al Blog
          </Link>
        </div>

        <div className="lg:grid lg:grid-cols-[1fr_280px] lg:items-start lg:gap-12">
        <div className="min-w-0">
        <header className="relative mb-12 h-64 sm:h-80 md:h-96 w-full overflow-hidden rounded-2xl md:rounded-3xl shadow-[0_12px_40px_-20px_rgba(12,17,29,0.25)] dark:shadow-[0_0_30px_rgba(0,240,255,0.05)]">
          {/* L4 (WO-2026-00345): la columna del artículo no supera ~768 px en
              desktop; `sizes=100vw` pedía una imagen del ancho de la pantalla.
              `priority` se mantiene (es el LCP del artículo). */}
          <Image src={coverImage} alt={coverAlt} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 768px" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          <div className="absolute bottom-0 left-0 w-full p-6 md:p-8 lg:p-12">
            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              {post.category && (
                <span className="rounded-full bg-primary/5 dark:bg-cyan-950/50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand">
                  {post.category}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/85 dark:text-zinc-300">
                <CalendarDays className="h-4 w-4" aria-hidden />
                {publishedStr} • {readTime}
              </span>
              {updatedStr && (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground dark:text-zinc-400">
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Actualizado el {updatedStr}
                </span>
              )}
            </div>
            <h1 className="text-3xl font-extrabold leading-tight text-foreground dark:text-white md:text-4xl lg:text-5xl">
              {post.title}
            </h1>
          </div>
        </header>

        {headings.length >= 3 && (
          <nav
            aria-label="Tabla de contenidos"
            className="mb-10 rounded-xl border border-border dark:border-white/10 bg-card dark:bg-white/[0.03] p-5"
          >
            <p className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground dark:text-zinc-400">En este artículo</p>
            <ol className="space-y-1.5 text-sm">
              {headings.map((h) => (
                <li key={h.id} className={h.depth === 3 ? 'pl-4' : ''}>
                  <a href={`#${h.id}`} className="text-foreground/85 dark:text-zinc-300 transition-colors hover:text-brand">
                    {h.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <article className="prose dark:prose-invert prose-lg max-w-none text-foreground/85 dark:text-zinc-300">
          <MarkdownRenderer content={post.body} />
        </article>

        {/* ── Paridad Encino (WO-2026-00088): FAQ · Ubicación · Etiquetas ── */}
        {post.faq.length > 0 && (
          <section aria-labelledby="faq-heading" className="mt-14">
            <h2 id="faq-heading" className="mb-4 text-2xl font-bold text-foreground dark:text-white">Preguntas frecuentes</h2>
            <dl className="divide-y divide-border dark:divide-white/10 rounded-xl border border-border dark:border-white/10 bg-card dark:bg-white/[0.03]">
              {post.faq.map((item) => (
                <div key={item.question} className="p-5">
                  <dt className="font-semibold text-foreground dark:text-zinc-100">{item.question}</dt>
                  <dd className="mt-2 text-muted-foreground dark:text-zinc-400">{item.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {post.mapsEmbed && (
          <section aria-labelledby="ubicacion-heading" className="mt-14">
            <h2 id="ubicacion-heading" className="mb-4 text-2xl font-bold text-foreground dark:text-white">Ubicación</h2>
            <div className="overflow-hidden rounded-xl border border-border dark:border-white/10">
              <iframe
                src={post.mapsEmbed}
                title="Mapa"
                width="100%"
                height="360"
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </section>
        )}

        {post.tags.length > 0 && (
          <ul aria-label="Etiquetas" className="mt-10 flex flex-wrap gap-2">
            {post.tags.map((t) => (
              <li key={t}>
                <Link href={`/blog?etiqueta=${encodeURIComponent(t)}`} className="rounded-full border border-border dark:border-white/10 px-3 py-1 text-xs text-muted-foreground dark:text-zinc-400 transition-colors hover:border-primary/50 hover:text-foreground dark:hover:text-white">
                  #{t}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {verifiedSources.length > 0 && (
          <section aria-labelledby="fuentes-heading" className="mt-14 rounded-xl border border-border dark:border-white/10 bg-card dark:bg-white/[0.03] p-6">
            <h2 id="fuentes-heading" className="mb-4 text-lg font-bold text-foreground dark:text-white">
              Fuentes y referencias
            </h2>
            <ol className="space-y-3 text-sm">
              {verifiedSources.map((s) => (
                <li key={s.url} className="text-muted-foreground dark:text-zinc-400">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-brand dark:text-blue-400 underline underline-offset-4 hover:text-brand/80 dark:hover:text-blue-300"
                  >
                    {s.title}
                  </a>
                  {s.publisher && <span> — {s.publisher}</span>}
                  {s.accessedAt && <span className="text-muted-foreground dark:text-zinc-600"> (consultado: {s.accessedAt.slice(0, 10)})</span>}
                </li>
              ))}
            </ol>
          </section>
        )}

        <footer className="mt-14 border-t border-border dark:border-white/10 pt-8">
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
            <div>
              <p className="text-muted-foreground dark:text-zinc-500">Escrito por</p>
              <Link href="/equipo" className="font-semibold text-foreground/85 dark:text-zinc-200 transition-colors hover:text-brand">
                {post.authorName}
              </Link>
              <p className="text-muted-foreground dark:text-zinc-500">Equipo PixelTEC · Puerto Vallarta, México</p>
            </div>
            <span className="text-muted-foreground dark:text-zinc-500">{publishedStr}</span>
          </div>

          <div className="mt-10 rounded-2xl border border-primary/20 dark:border-cyan-500/20 bg-primary/5 dark:bg-cyan-950/20 p-6 md:p-8">
            <h2 className="text-xl font-bold text-foreground dark:text-white md:text-2xl">
              ¿Quieres aplicar esto en tu empresa?
            </h2>
            <p className="mt-2 max-w-2xl text-muted-foreground dark:text-zinc-400">
              Diagnosticamos tu operación y te decimos, sin humo, qué automatizar primero y qué retorno esperar.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {/* WO-2026-00214: sólo atributos data-* para el tracker de
                  contenido. Cero cambio visual, cero clases nuevas. */}
              <Link
                href="/diagnostico"
                data-cta="diagnostico"
                data-cta-pos="article_footer"
                className="inline-flex items-center rounded-lg bg-cyan-500 px-5 py-2.5 font-semibold text-black transition-colors hover:bg-cyan-400"
              >
                Hacer el diagnóstico
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                data-cta="contacto"
                data-cta-pos="article_footer"
                className="inline-flex items-center rounded-lg border border-border dark:border-white/20 px-5 py-2.5 font-semibold text-foreground dark:text-white transition-colors hover:bg-secondary dark:hover:bg-white/10"
              >
                Hablar con el equipo
              </Link>
            </div>
          </div>

          {resourceLinks.length > 0 && (
            <section aria-labelledby="internal-links-heading" className="mt-12">
              <h2 id="internal-links-heading" className="mb-4 text-xl font-bold text-foreground dark:text-white">
                Recursos de PixelTEC mencionados
              </h2>
              <ul className="space-y-2.5">
                {resourceLinks.map((l) => (
                  <li key={`${l.targetUrl}|${l.anchor}`}>
                    <Link
                      href={l.targetUrl}
                      data-cta="internal_link"
                      data-cta-pos="article_body"
                      className="group inline-flex items-center gap-2 font-medium text-foreground/85 dark:text-zinc-300 transition-colors hover:text-brand"
                    >
                      <ArrowRight className="h-4 w-4 text-brand transition-transform group-hover:translate-x-1" aria-hidden />
                      {l.anchor}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {related.length > 0 && (
            <section aria-labelledby="related-heading" className="mt-12">
              <h2 id="related-heading" className="mb-5 text-xl font-bold text-foreground dark:text-white">
                Sigue leyendo
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/blog/${r.slug}`}
                    data-cta="related"
                    data-cta-pos="article_footer"
                    className="group rounded-xl border border-border dark:border-white/10 bg-card dark:bg-white/[0.03] p-5 transition-colors hover:border-primary/40 dark:hover:border-cyan-500/40"
                  >
                    <span className="text-xs font-bold uppercase tracking-wide text-brand">{r.category}</span>
                    <h3 className="mt-2 font-semibold text-foreground dark:text-zinc-100 group-hover:text-foreground dark:group-hover:text-white">{r.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground dark:text-zinc-500">{r.excerpt}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* L6 (WO-2026-00346): ficha de Google al cierre del artículo (como el
              GmbCard del sidebar de Encino); iframe lazy, lejos del LCP. */}
          <GoogleBusinessCard className="mt-12 max-w-md" />
        </footer>
        </div>

        <div className="hidden lg:block">
          <BlogSidebar
            recentPosts={sidebar.recentPosts}
            categories={sidebar.categories}
            tags={sidebar.tags}
          />
        </div>
        </div>
      </div>
    </main>
  );
}
