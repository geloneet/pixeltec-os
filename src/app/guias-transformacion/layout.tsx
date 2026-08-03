import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { BreadcrumbStructuredData } from '@/components/seo/structured-data';
import { SITE } from '@/lib/site-config';

export const metadata: Metadata = buildMetadata({
  path: '/guias-transformacion',
  title: 'Guías de Transformación Digital · Recursos exclusivos',
  description: 'Accede a nuestro centro de recursos exclusivos: playbooks, arquitecturas y estrategias para escalar tu ecosistema digital.',
});

export default function GuiasLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbStructuredData items={[
        { name: SITE.name, url: SITE.url },
        { name: 'Guías de Transformación', url: `${SITE.url}/guias-transformacion` },
      ]} />
      {children}
    </>
  );
}
