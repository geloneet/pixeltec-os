import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SITE } from '@/lib/site-config';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from '@/components/theme-provider';
import { Poppins, Roboto, League_Spartan } from 'next/font/google';
import { OrganizationStructuredData } from '@/components/seo/structured-data';
import { PublishedStructuredData } from '@/components/seo/published-structured-data';
import { MetaPixel } from '@/components/analytics/meta-pixel';
import { ConsentBanner } from '@/components/analytics/consent-banner';
import { AttributionCapture } from '@/components/analytics/attribution-capture';
import { headers } from 'next/headers';

// REN-05 (WO-2026-00268): el peso 900 no lo usaba nadie salvo un enlace del
// menú móvil (ahora `font-extrabold`); descargarlo en cada visita era peso
// muerto en la ruta crítica.
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
});

// REN-05: `font-roboto` sólo aparece en pantallas del CRM/admin (stat-card,
// cobros, PortalTab). Sin `preload` el navegador no reserva ancho de banda por
// ella en las páginas públicas; se descarga sólo donde de verdad se usa.
const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-roboto',
  display: 'swap',
  preload: false,
});

const leagueSpartan = League_Spartan({
  subsets: ['latin'],
  weight: ['800'],
  variable: '--font-league-spartan',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} | Ecosistemas Digitales y Automatización`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  // SEO-07 (WO-2026-00268): `keywords` está deprecado desde 2009 para Google y
  // Bing; no aporta ranking y sí señala keyword stuffing. Retirado a propósito.
  authors: [{ name: SITE.name }],
  // Los iconos salen de la convención de archivos de Next (src/app/icon.png y
  // src/app/apple-icon.png — el apple es 180×180 OPACO; el ptlogox.png
  // transparente se veía negro sobre negro al anclar en iOS).
};

export const viewport: Viewport = {
  themeColor: '#030303',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html lang="es-MX" className={cn('scroll-smooth', poppins.variable, roboto.variable, leagueSpartan.variable)} suppressHydrationWarning>
      <body className={cn('font-body antialiased min-h-screen bg-background text-foreground')}>
        <ThemeProvider nonce={nonce}>
          <OrganizationStructuredData />
          {/* JSON-LD publicado desde el módulo SEO (WO-2026-00095). */}
          <PublishedStructuredData />
          {/* PRV-01/REN-04 (WO-2026-00268): MetaPixel ya no imprime script
              inline (por eso deja de necesitar el nonce) y no carga nada
              hasta que ConsentBanner registra un «Aceptar». */}
          <MetaPixel />
          {/* WO-2026-00214: cookie first-party `pt_attr` (90 d, SameSite=Lax).
              Va en el layout raíz —y no solo en el blog— porque el primer
              contacto puede haber sido cualquier página pública. */}
          <AttributionCapture />
          <SessionProvider>
            {children}
            <Toaster />
          </SessionProvider>
          <ConsentBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
