import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { BreadcrumbStructuredData } from '@/components/seo/structured-data';
import { SITE } from '@/lib/site-config';

// SEO-05 (WO-2026-00268): ~100 palabras de copy para una página que compite
// por una consulta comercial. Mismo tratamiento que /guias-transformacion:
// fuera del índice y del sitemap hasta que tenga contenido real (pendiente de
// que Miguel escriba y apruebe el copy — no se inventa aquí). `follow: true`
// para no cortar el enlazado interno.
export const metadata: Metadata = {
  ...buildMetadata({
    path: '/metodologia',
    title: 'Metodología · Nuestro proceso de trabajo',
    description: 'Descubre nuestro proceso de ingeniería estructurado, desde el diagnóstico y la arquitectura hasta el desarrollo ágil, el despliegue en la nube y la evolución continua con IA.',
  }),
  robots: { index: false, follow: true },
};

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
