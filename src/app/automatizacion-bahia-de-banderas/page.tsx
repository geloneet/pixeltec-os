import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import {
  BreadcrumbStructuredData,
  StandaloneServiceStructuredData,
  FAQPageStructuredData,
} from '@/components/seo/structured-data';
import { getLocalCity } from '@/lib/content/automatizacion-local';
import { SITE } from '@/lib/site-config';
import LocalAutomationPage from '@/components/site/local-automation-page';

const SLUG = 'automatizacion-bahia-de-banderas';

export const metadata: Metadata = (() => {
  const city = getLocalCity(SLUG);
  if (!city) return { title: 'Página no encontrada' };
  return buildMetadata({
    path: `/${SLUG}`,
    title: city.metaTitle,
    description: city.metaDescription,
  });
})();

export default function Page() {
  const city = getLocalCity(SLUG);
  if (!city) notFound();
  return (
    <>
      <BreadcrumbStructuredData
        items={[
          { name: SITE.name, url: SITE.url },
          { name: 'Servicios', url: `${SITE.url}/services` },
          { name: 'Automatización de Procesos', url: `${SITE.url}/services/automatizacion` },
          { name: city.h1, url: `${SITE.url}/${SLUG}` },
        ]}
      />
      <StandaloneServiceStructuredData
        url={`${SITE.url}/${SLUG}`}
        name={city.metaTitle}
        description={city.metaDescription}
        areaServedCity={city.city}
      />
      <FAQPageStructuredData items={city.faq} />
      <LocalAutomationPage city={city} />
    </>
  );
}
