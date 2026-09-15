import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { buildMetadata } from '@/lib/seo';
import Header from '@/components/header';
import { HeroGeometric } from '@/components/ui/shape-landing-hero';
import { AboutWaveSection } from '@/components/ui/about-wave-section';
import { DiagnosticModalProvider } from '@/components/diagnostico/diagnostic-modal-provider';
import { HomeStructuredData } from '@/components/seo/home-structured-data';
import { LocalLandingsSection } from '@/components/sections/local-landings';
import { HOME_HERO, HOME_SEO } from '@/lib/content/home';

const LandingAccordionItem = dynamic(() =>
  import('@/components/ui/interactive-image-accordion').then((m) => m.LandingAccordionItem)
);
const IndustriesStrip = dynamic(() => import('@/components/sections/industries-strip'));
const TestimonialsSection = dynamic(() => import('@/components/sections/testimonials'));
// Sección de Diagnóstico en tarjeta desactivada temporalmente (2026-07-24).
// const DiagnosticCtaSection = dynamic(() => import('@/components/sections/diagnostic-cta'));
// Formulario de contacto retirado del inicio (2026-07-24); vive en /contact.
// const ContactSection = dynamic(() => import('@/components/sections/contact'));
const DiagnosticInlineSection = dynamic(() => import('@/components/sections/diagnostic-inline'));
const Footer = dynamic(() =>
  import('@/components/ui/footer-section').then((m) => m.Footer)
);

// Copy y metadata en src/lib/content/home.ts (WO-2026-00343). La raíz no
// recibe el template `%s | PixelTEC` del layout: el título sale tal cual.
export const metadata: Metadata = buildMetadata({
  path: '/',
  ...HOME_SEO,
});

export default function Home() {
  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <Header />

      {/* JSON-LD de la portada: ItemList + Service ×3 (WO-2026-00343). */}
      <HomeStructuredData />

      {/* Franja superior anclada a la ventana: el contenido que sube hacia el
          borde va perdiendo visibilidad de forma progresiva hasta desaparecer
          al llegar arriba. Es CSS puro, sin listeners de scroll, y afecta solo
          a la porción de pantalla que atraviesa — no a la sección completa. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[22vh] bg-gradient-to-b from-background via-background/85 to-transparent"
      />

      {/* El proveedor mantiene UNA sola instancia del wizard para los
          disparadores del hero y de Servicios. */}
      <DiagnosticModalProvider>
        <main className="flex-1">
          <HeroGeometric {...HOME_HERO} />
          <AboutWaveSection />
          <LandingAccordionItem />
          <TestimonialsSection />
          <DiagnosticInlineSection />
          <IndustriesStrip />
          {/* Enlazado interno a las 12 landings ciudad×servicio + 6 guías (WO-2026-00343). */}
          <LocalLandingsSection />
        </main>
      </DiagnosticModalProvider>
      <Footer />
    </div>
  );
}
