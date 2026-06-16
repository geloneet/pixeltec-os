import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { buildMetadata } from '@/lib/seo';
import Header from '@/components/header';
import { HeroGeometric } from '@/components/ui/shape-landing-hero';
import { LazyWaveSection } from '@/components/ui/lazy-wave-section';
// Below-fold sections: code-split into separate chunks.
// SSR is kept (no ssr:false) so text content stays in the server HTML for SEO.
const LandingAccordionItem = dynamic(() =>
  import('@/components/ui/interactive-image-accordion').then((m) => m.LandingAccordionItem)
);
const BenefitsSection = dynamic(() => import('@/components/sections/benefits'));
const TestimonialsSection = dynamic(() => import('@/components/sections/testimonials'));
const ContactSection = dynamic(() => import('@/components/sections/contact'));
const NewsletterSection = dynamic(() =>
  import('@/components/ui/newsletter-section').then((m) => m.NewsletterSection)
);
const Footer = dynamic(() =>
  import('@/components/ui/footer-section').then((m) => m.Footer)
);

export const metadata: Metadata = buildMetadata({
  path: '/',
  title: 'PixelTEC | Ecosistemas Digitales y Automatización',
  description: 'Transformamos procesos complejos en ecosistemas web y automatizaciones escalables para empresas que buscan rentabilidad y control absoluto.',
});

export default function Home() {
  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <Header />
      <main className="flex-1">
        <HeroGeometric
          badge="Innovación & Desarrollo"
          title1="Diseñamos el Futuro"
          title2="Digital de tu Empresa"
        />
        <LazyWaveSection />
        <LandingAccordionItem />
        <BenefitsSection />
        <TestimonialsSection />
        <ContactSection />
        <NewsletterSection />
      </main>
      <Footer />
    </div>
  );
}
