import Header from '@/components/header';
import { Footer } from '@/components/ui/footer-section';
import { ContentTracker } from '@/components/analytics/content-tracker';

// Sin export de metadata a propósito: un `title` string plano aquí reseteaba
// el template `%s | PixelTEC` del root layout para todo el subárbol — los
// artículos salían sin marca en el <title>. El listado define su propio título
// vía buildMetadata en page.tsx.
//
// Header/Footer viven AQUÍ para que el detalle del artículo (que antes no
// montaba ninguno) tenga navegación global y los enlaces internos del footer —
// era el mayor agujero de linking interno del sitio (P0-3).
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* WO-2026-00214: mide lectura y clics de CTA en el contenido público.
          Vive aquí y no en el layout raíz porque sólo el blog y las landings
          de keyword son "contenido" para el módulo SEO & Contenido. */}
      <ContentTracker />
      <Header />
      {children}
      <Footer />
    </>
  );
}
