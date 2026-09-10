import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { BreadcrumbStructuredData } from '@/components/seo/structured-data';
import { SITE } from '@/lib/site-config';

// SEO-05 (WO-2026-00268): la página anuncia recursos que todavía no existen
// («Próximamente» en las tres tarjetas). Indexada, es contenido delgado que
// arrastra la calidad percibida del dominio. Queda fuera del índice y fuera
// del sitemap hasta que tenga guías reales; `follow: true` porque sus enlaces
// internos sí valen. Revertir es quitar estas tres líneas y su fila en
// src/app/sitemap.ts.
export const metadata: Metadata = {
  ...buildMetadata({
    path: '/guias-transformacion',
    title: 'Guías de Transformación Digital · Recursos exclusivos',
    description: 'Accede a nuestro centro de recursos exclusivos: playbooks, arquitecturas y estrategias para escalar tu ecosistema digital.',
  }),
  robots: { index: false, follow: true },
};

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
