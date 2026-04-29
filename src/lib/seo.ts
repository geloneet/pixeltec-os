import type { Metadata } from 'next';

const BASE_URL = 'https://pixeltec.mx';
const DEFAULT_OG_IMAGE = '/og-image.png';

interface BuildMetadataOptions {
  path: string;
  title: string;
  description: string;
  ogImage?: string;
}

export function buildMetadata({ path, title, description, ogImage }: BuildMetadataOptions): Metadata {
  const url = `${BASE_URL}${path}`;
  const image = ogImage ?? DEFAULT_OG_IMAGE;
  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: 'website',
      url,
      siteName: 'PixelTEC',
      title,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}
