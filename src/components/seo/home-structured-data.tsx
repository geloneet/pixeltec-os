import { SITE, absoluteUrl } from '@/lib/site-config';
import { SERVED_CITY_NAMES, SERVICES_CATALOG } from '@/lib/content/services-catalog';
import { ORG_ID } from './structured-data';

/**
 * JSON-LD propio de la portada (WO-2026-00343): un `ItemList` con los tres
 * servicios y un `Service` por cada uno, ligados por `@id` a la Organization
 * que ya emite el layout raíz. Server Component, como el resto de
 * `components/seo`: tiene que viajar en el HTML inicial.
 *
 * No emite `Organization` ni `WebSite` (duplicarían los del layout) ni
 * `BreadcrumbList` — una lista de un solo elemento en la raíz no produce rich
 * result (decisión de Miguel, 2026-09-14). Tampoco `LocalBusiness`: exige
 * dirección física pública acreditada. Si el panel `/seo/schema` llegara a
 * asignar `Service` a `/`, saldrían nodos esqueleto duplicados: no asignarlo.
 */
const serviceId = (slug: string) => `${absoluteUrl(`/services/${slug}`)}#service`;

export function buildHomeGraph() {
  const areaServed = [
    ...SERVED_CITY_NAMES.map((name) => ({ '@type': 'City', name })),
    { '@type': 'Country', name: 'Mexico' },
  ];
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ItemList',
        '@id': `${SITE.url}/#services`,
        name: `Servicios de ${SITE.name}`,
        numberOfItems: SERVICES_CATALOG.length,
        itemListElement: SERVICES_CATALOG.map((s, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: { '@id': serviceId(s.slug) },
        })),
      },
      ...SERVICES_CATALOG.map((s) => ({
        '@type': 'Service',
        '@id': serviceId(s.slug),
        name: s.name,
        serviceType: s.serviceType,
        description: s.description,
        url: absoluteUrl(`/services/${s.slug}`),
        provider: { '@id': ORG_ID },
        areaServed,
      })),
    ],
  };
}

export function HomeStructuredData() {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildHomeGraph()) }} />
  );
}
