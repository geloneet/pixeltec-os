import type { Metadata } from 'next';
import { SITE, absoluteUrl } from '@/lib/site-config';

interface ArticleMeta {
  publishedTime: string;
  modifiedTime?: string;
  authors: string[];
}

interface BuildMetadataOptions {
  path: string;
  title: string;
  description: string;
  ogImage?: string;
  /** Alt descriptivo de la imagen OG. Sin él, se usa el título (comportamiento
   *  histórico) — preferir siempre un alt que describa la imagen. */
  ogImageAlt?: string;
  /** Marca la página como no indexable (robots meta). */
  noindex?: boolean;
  /** Si se pasa, el OG sale como `article` con sus fechas/autores en lugar de
   *  `website` — evita que cada página lo parchee a mano con spreads. */
  article?: ArticleMeta;
}

export function buildMetadata({
  path,
  title,
  description,
  ogImage,
  ogImageAlt,
  noindex,
  article,
}: BuildMetadataOptions): Metadata {
  const url = absoluteUrl(path);
  const image = ogImage ?? SITE.defaultOgImage;
  const imageAlt = ogImageAlt ?? title;
  return {
    title,
    description,
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
    alternates: {
      canonical: url,
    },
    openGraph: {
      ...(article
        ? {
            type: 'article',
            publishedTime: article.publishedTime,
            ...(article.modifiedTime ? { modifiedTime: article.modifiedTime } : {}),
            authors: article.authors,
          }
        : { type: 'website' }),
      url,
      siteName: SITE.name,
      locale: SITE.ogLocale,
      title,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: imageAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}
