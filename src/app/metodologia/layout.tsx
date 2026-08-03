import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { BreadcrumbStructuredData } from '@/components/seo/structured-data';
import { SITE } from '@/lib/site-config';

export const metadata: Metadata = buildMetadata({
  path: '/metodologia',
  title: 'Metodología · Nuestro proceso de trabajo',
  description: 'Descubre nuestro proceso de ingeniería estructurado, desde el diagnóstico y la arquitectura hasta el desarrollo ágil, el despliegue en la nube y la evolución continua con IA.',
});

export default function MetodologiaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbStructuredData items={[
        { name: SITE.name, url: SITE.url },
        { name: 'Metodología', url: `${SITE.url}/metodologia` },
      ]} />
      {children}
    </>
  );
}
