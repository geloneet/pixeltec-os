import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SITE } from '@/lib/site-config';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from '@/components/theme-provider';
import { Poppins, Roboto, League_Spartan } from 'next/font/google';
import { OrganizationStructuredData } from '@/components/seo/structured-data';
import { MetaPixel } from '@/components/analytics/meta-pixel';
import { headers } from 'next/headers';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-poppins',
  display: 'swap',
});

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-roboto',
  display: 'swap',
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
  keywords: ['desarrollo web México', 'automatización de procesos', 'CRM personalizado', 'consultoría tecnológica Puerto Vallarta', 'ecosistemas digitales', 'software a medida'],
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
          <MetaPixel nonce={nonce} />
          <SessionProvider>
            {children}
            <Toaster />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
