import Header from '@/components/header';
import { Footer } from '@/components/ui/footer-section';
import {
  BreadcrumbStructuredData,
  FAQPageStructuredData,
  StandaloneServiceStructuredData,
} from '@/components/seo/structured-data';
import { buildMetadata } from '@/lib/seo';
import { PixelbotCapabilities } from '@/components/pixelbot-landing/pixelbot-capabilities';
import { PixelbotClientBranding } from '@/components/pixelbot-landing/pixelbot-client-branding';
import { PixelbotComparison } from '@/components/pixelbot-landing/pixelbot-comparison';
import { PixelbotConsoleShowcase } from '@/components/pixelbot-landing/pixelbot-console-showcase';
import { FAQ, PIXELBOT_PATH, SEO_META } from '@/components/pixelbot-landing/pixelbot-content';
import { PixelbotFaq } from '@/components/pixelbot-landing/pixelbot-faq';
import { PixelbotHero } from '@/components/pixelbot-landing/pixelbot-hero';
import { PixelbotImplementation } from '@/components/pixelbot-landing/pixelbot-implementation';
import { PixelbotLeadForm } from '@/components/pixelbot-landing/pixelbot-lead-form';
import { PixelbotPricing } from '@/components/pixelbot-landing/pixelbot-pricing';
import { PixelbotWorkflow } from '@/components/pixelbot-landing/pixelbot-workflow';

export const metadata = buildMetadata({
  path: PIXELBOT_PATH,
  title: SEO_META.title,
  description: SEO_META.description,
  ogImage: SEO_META.ogImage,
});

export default function PixelbotPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <BreadcrumbStructuredData
        items={[
          { name: 'Inicio', url: 'https://pixeltec.mx' },
          { name: 'WhatsAgent', url: `https://pixeltec.mx${PIXELBOT_PATH}` },
        ]}
      />
      <StandaloneServiceStructuredData
        url={`https://pixeltec.mx${PIXELBOT_PATH}`}
        name={SEO_META.serviceName}
        description={SEO_META.serviceDescription}
      />
      <FAQPageStructuredData items={FAQ.items} />

      <Header />
      <main className="flex-1">
        <PixelbotHero />
        <PixelbotClientBranding />
        <PixelbotWorkflow />
        <PixelbotCapabilities />
        <PixelbotConsoleShowcase />
        <PixelbotComparison />
        <PixelbotPricing />
        <PixelbotImplementation />
        <PixelbotFaq />
        <PixelbotLeadForm />
      </main>
      <Footer />
    </div>
  );
}
