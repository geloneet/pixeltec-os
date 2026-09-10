import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { BreadcrumbStructuredData } from '@/components/seo/structured-data';
import { SITE } from '@/lib/site-config';

export const metadata: Metadata = buildMetadata({
  path: '/about',
  title: 'Nosotros · Quiénes somos',
  description: 'Conoce a PixelTEC: un arquitecto líder, una red de especialistas por proyecto y una metodología que convierte desafíos en ventaja competitiva.',
});

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbStructuredData items={[
        { name: SITE.name, url: SITE.url },
        { name: 'Nosotros', url: `${SITE.url}/about` },
      ]} />
      {children}
    </>
  );
}
