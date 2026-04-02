import Header from '@/components/header';
import BenefitsSection from '@/components/sections/benefits';
import TestimonialsSection from '@/components/sections/testimonials';
import { Footer } from '@/components/ui/footer-section';
import { HeroGeometric } from '@/components/ui/shape-landing-hero';
import { NewsletterSection } from '@/components/ui/newsletter-section';
import { AboutWaveSection } from '@/components/ui/about-wave-section';
import { LandingAccordionItem } from '@/components/ui/interactive-image-accordion';
import ContactSection from '@/components/sections/contact';

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
        <AboutWaveSection />
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
