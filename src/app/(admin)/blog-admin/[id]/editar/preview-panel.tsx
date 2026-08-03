"use client";

import { useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui/spinner";

const MarkdownRenderer = dynamic(() => import("@/components/blog/markdown-renderer"), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center py-10">
      <Spinner size="sm" />
    </div>
  ),
});

function truncate(text: string, max: number): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

interface PreviewPanelProps {
  title: string;
  excerpt: string;
  body: string;
  slug: string;
  coverImage: string | null;
  coverImageAlt: string;
  metaTitle: string;
  metaDescription: string;
}

export function PreviewPanel({
  title,
  excerpt,
  body,
  slug,
  coverImage,
  coverImageAlt,
  metaTitle,
  metaDescription,
}: PreviewPanelProps) {
  const [ogImageError, setOgImageError] = useState(false);

  // Mismos fallbacks que aplica el servidor: metaTitle→title, metaDescription→excerpt.
  const serpTitle = truncate(metaTitle || title || "(sin título)", 60);
  const serpDescription = truncate(metaDescription || excerpt || "", 160);
  const displaySlug = slug || "url-del-articulo";

  return (
    <div className="space-y-6">
      {/* ── Preview SERP (Google) ── */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Resultado en Google
        </h3>
        <div className="rounded-xl border border-border bg-white p-4 dark:bg-zinc-900">
          <p className="text-xs text-[#202124] dark:text-zinc-300">
            pixeltec.mx <span className="text-[#5f6368] dark:text-zinc-500">› blog › {displaySlug}</span>
          </p>
          <p className="mt-1 text-xl leading-snug text-[#1a0dab] hover:underline dark:text-blue-400">
            {serpTitle}
          </p>
          <p className="mt-1 text-sm leading-snug text-[#4d5156] dark:text-zinc-400">
            {serpDescription}
          </p>
        </div>
      </section>

      {/* ── Preview OG (compartir en redes) ── */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Tarjeta al compartir (Open Graph)
        </h3>
        <div className="max-w-md overflow-hidden rounded-xl border border-border bg-card">
          <div className="relative aspect-[1200/630] w-full bg-secondary">
            {coverImage && !ogImageError ? (
              <Image
                src={coverImage}
                alt={coverImageAlt || title || "Portada"}
                fill
                className="object-cover"
                onError={() => setOgImageError(true)}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Sin portada — se usará la imagen OG genérica del sitio
              </div>
            )}
          </div>
          <div className="space-y-1 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              pixeltec.mx
            </p>
            <p className="line-clamp-2 text-sm font-semibold text-foreground">
              {metaTitle || title || "(sin título)"}
            </p>
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {metaDescription || excerpt}
            </p>
          </div>
        </div>
      </section>

      {/* ── Artículo renderizado ── */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Artículo
        </h3>
        {/* El renderer público asume fondo oscuro (texto blanco): se envuelve
            en el mismo contexto visual que la página real del blog. */}
        <article className="rounded-xl border border-border bg-zinc-950 p-6">
          {body.trim() ? (
            <MarkdownRenderer content={body} />
          ) : (
            <p className="text-sm text-zinc-500">El cuerpo del artículo está vacío.</p>
          )}
        </article>
      </section>
    </div>
  );
}
