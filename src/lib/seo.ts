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
  /**
   * Para metadata de un LAYOUT con rutas hijas (SEO-02, WO-2026-00268).
   *
   * Un `title` string plano en un layout intermedio se convierte en el título
   * resuelto de todo su subárbol y, de paso, RESETEA el `template`
   * `%s | PixelTEC` del layout raíz: los hijos salían sin marca. Con esta
   * opción el título se emite como `{ default, template }` — `default` es el
   * título del propio segmento (y sí recibe el template del padre) y
   * `template` se re-declara para que los hijos lo hereden.
   */
  childTemplate?: boolean;
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
  childTemplate,
}: BuildMetadataOptions): Metadata {
  const url = absoluteUrl(path);
  const image = ogImage ?? SITE.defaultOgImage;
  const imageAlt = ogImageAlt ?? title;
  return {
    // OG y Twitter conservan el título plano a propósito: las tarjetas
    // sociales no aplican templates y `${title} | PixelTEC` ahí sería ruido.
    title: childTemplate
      ? { default: title, template: `%s | ${SITE.name}` }
      : title,
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
