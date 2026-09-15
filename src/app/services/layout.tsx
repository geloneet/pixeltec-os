import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { BreadcrumbStructuredData } from '@/components/seo/structured-data';
import { SITE } from '@/lib/site-config';

// `childTemplate: true` (SEO-02, WO-2026-00268): sin él, el título string de
// este layout reseteaba el template `%s | PixelTEC` del root para todo
// /services/[slug] — los detalles de servicio salían sin marca en el <title>.
// Title con intención (WO-2026-00352): nombra los tres servicios en vez del
// eslogan «Soluciones de alto impacto»; ≤ 49 chars para que con ` | PixelTEC`
// quede ≤ 60.
export const metadata: Metadata = buildMetadata({
  path: '/services',
  title: 'Servicios de desarrollo web, IA y consultoría',
  description: 'Descubre nuestras soluciones de alto impacto: Ecosistemas Web Avanzados, Automatización de Procesos y Consultoría Tecnológica para modernizar tu empresa.',
  childTemplate: true,
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
