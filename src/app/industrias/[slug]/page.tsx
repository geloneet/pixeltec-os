import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { buildMetadata } from '@/lib/seo';
import { SITE } from '@/lib/site-config';
import Header from '@/components/header';
import { Footer } from '@/components/ui/footer-section';
import { BreadcrumbStructuredData, FAQPageStructuredData } from '@/components/seo/structured-data';
import { IndustryStructuredData } from '@/components/seo/industry-structured-data';
import { IndustryPage } from '@/components/site/industry-page';
import { getIndustryPage, industriesWithPage, industryPagePath } from '@/lib/content/industrias';

/**
 * Páginas propias de industria (WO-2026-00345, L2): `/industrias/<slug>` solo
 * para las industrias del registro con `page` (hoy clínicas dentales y
 * hoteles). `dynamicParams = false`: cualquier otro slug —incluidos los
 * bloques sin página como `/industrias/logistica`— responde 404, no una
 * página vacía.
 */
export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return industriesWithPage().map((industry) => ({ slug: industry.page.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const industry = getIndustryPage(slug);
  if (!industry) return { title: 'Página no encontrada' };
  return buildMetadata({
    path: industryPagePath(industry.page),
    title: industry.page.metaTitle,
    description: industry.page.metaDescription,
  });
}

export default async function IndustryLeafPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const industry = getIndustryPage(slug);
  if (!industry) notFound();

  const url = `${SITE.url}${industryPagePath(industry.page)}`;
  return (
    <>
      <BreadcrumbStructuredData
        items={[
          { name: SITE.name, url: SITE.url },
          { name: 'Industrias', url: `${SITE.url}/industrias` },
          { name: industry.page.h1, url },
        ]}
      />
      <IndustryStructuredData industry={industry} />
      {/* Mismo texto que la FAQ visible (requisito de Google para rich results). */}
      <FAQPageStructuredData items={industry.page.faq} />
      <Header />
      <IndustryPage industry={industry} />
      <Footer />
    </>
  );
}
