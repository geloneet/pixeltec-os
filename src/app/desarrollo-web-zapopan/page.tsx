import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import {
  BreadcrumbStructuredData,
  StandaloneServiceStructuredData,
  FAQPageStructuredData,
} from '@/components/seo/structured-data';
import { getLocalServiceCity } from '@/lib/content/local-services';
import { SITE } from '@/lib/site-config';
import LocalServicePage from '@/components/site/local-service-page';

const SLUG = 'desarrollo-web-zapopan';
const SERVICE_HREF = '/services/ecosistemas-web';
const SERVICE_LABEL = 'Ecosistemas Web Avanzados';

export const metadata: Metadata = (() => {
  const city = getLocalServiceCity(SLUG);
  if (!city) return { title: 'Página no encontrada' };
  return buildMetadata({
    path: `/${SLUG}`,
    title: city.metaTitle,
    description: city.metaDescription,
  });
})();

export default function Page() {
  const city = getLocalServiceCity(SLUG);
  if (!city) notFound();
  return (
    <>
      <BreadcrumbStructuredData
        items={[
          { name: SITE.name, url: SITE.url },
          { name: 'Servicios', url: `${SITE.url}/services` },
          { name: SERVICE_LABEL, url: `${SITE.url}${SERVICE_HREF}` },
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
      <LocalServicePage city={city} serviceHref={SERVICE_HREF} serviceLabel={SERVICE_LABEL} ctaVerb="desarrollar tu proyecto" />
    </>
  );
}
