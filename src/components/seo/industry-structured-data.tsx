import { SITE, absoluteUrl } from '@/lib/site-config';
import { SERVED_CITY_NAMES } from '@/lib/content/services-catalog';
import { industriesWithPage, industryPagePath, type IndustryPageContent, type IndustryWithPage } from '@/lib/content/industrias';
import { ORG_ID } from './structured-data';

/**
 * JSON-LD de industrias (WO-2026-00345, L2). Server Components, como el resto
 * de `components/seo`.
 *
 * - Página de industria: un `Service` con `@id <url>#service`, ligado por
 *   `provider` a la Organization del layout raíz, `areaServed` = las mismas
 *   ciudades del home (una sola fuente: `SERVED_CITY_NAMES`) y `audience`
 *   con el sector. No emite Organization/WebSite/LocalBusiness: la entidad
 *   local es una y vive en el layout.
 * - Hub: un `ItemList` que referencia por `@id` SOLO las industrias con
 *   página propia; los bloques sin URL no se listan (un ListItem sin destino
 *   no aporta nada y confunde al validador).
 */
export function industryServiceId(page: IndustryPageContent): string {
  return `${absoluteUrl(industryPagePath(page))}#service`;
}

const areaServed = () => [
  ...SERVED_CITY_NAMES.map((name) => ({ '@type': 'City', name })),
  { '@type': 'Country', name: 'Mexico' },
];

export function buildIndustryServiceGraph(industry: IndustryWithPage) {
  const { page } = industry;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        '@id': industryServiceId(page),
        name: page.h1,
        serviceType: page.serviceType,
        description: page.metaDescription,
        url: absoluteUrl(industryPagePath(page)),
        provider: { '@id': ORG_ID },
        audience: { '@type': 'Audience', audienceType: page.audienceType },
        areaServed: areaServed(),
      },
    ],
  };
}

export function buildIndustryHubGraph() {
  const pages = industriesWithPage();
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ItemList',
        '@id': `${absoluteUrl('/industrias')}#industrias`,
        name: `Industrias de ${SITE.name}`,
        numberOfItems: pages.length,
        itemListElement: pages.map((i, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          item: { '@id': industryServiceId(i.page) },
        })),
      },
    ],
  };
}

export function IndustryStructuredData({ industry }: { industry: IndustryWithPage }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(buildIndustryServiceGraph(industry)) }}
    />
  );
}

export function IndustryHubStructuredData() {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildIndustryHubGraph()) }} />
  );
}
