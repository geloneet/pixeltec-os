import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { BreadcrumbStructuredData } from '@/components/seo/structured-data';
import { SITE } from '@/lib/site-config';

export const metadata: Metadata = buildMetadata({
  path: '/services',
  title: 'Servicios · Soluciones de alto impacto',
  description: 'Descubre nuestras soluciones de alto impacto: Ecosistemas Web Avanzados, Automatización de Procesos y Consultoría Tecnológica para modernizar tu empresa.',
});

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbStructuredData items={[
        { name: SITE.name, url: SITE.url },
        { name: 'Servicios', url: `${SITE.url}/services` },
      ]} />
      {children}
    </>
  );
}
