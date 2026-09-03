import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import {
  BreadcrumbStructuredData,
  StandaloneServiceStructuredData,
  FAQPageStructuredData,
} from '@/components/seo/structured-data';
import { getKeywordLanding, KEYWORD_LANDING_HUBS } from '@/lib/content/keyword-landings';
import { SITE } from '@/lib/site-config';
import KeywordLandingPage from '@/components/site/keyword-landing-page';

// Archivo GENERADO por scripts/gen-keyword-landing-pages.mjs — no lo edites a
// mano: edita src/lib/content/keyword-landings-*.ts y vuelve a correr el script.

const SLUG = 'programador-de-software';

export const metadata: Metadata = (() => {
  const landing = getKeywordLanding(SLUG);
  if (!landing) return { title: 'Página no encontrada' };
  return buildMetadata({
    path: `/${SLUG}`,
    title: landing.metaTitle,
    description: landing.metaDescription,
  });
})();

export default function Page() {
  const landing = getKeywordLanding(SLUG);
  if (!landing) notFound();
  const hub = KEYWORD_LANDING_HUBS[landing.hub];
  return (
    <>
      <BreadcrumbStructuredData
        items={[
          { name: 'Inicio', url: SITE.url },
          { name: hub.label, url: `${SITE.url}${hub.href}` },
          { name: landing.h1, url: `${SITE.url}/${SLUG}` },
        ]}
      />
      <StandaloneServiceStructuredData
        url={`${SITE.url}/${SLUG}`}
        name={landing.metaTitle}
        description={landing.metaDescription}
        {...(landing.city ? { areaServedCity: landing.city.name } : {})}
      />
      <FAQPageStructuredData items={landing.faq} />
      <KeywordLandingPage landing={landing} />
    </>
  );
}
