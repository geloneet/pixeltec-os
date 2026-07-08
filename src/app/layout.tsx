import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from '@/components/theme-provider';
import { Poppins, Roboto, League_Spartan } from 'next/font/google';
import { OrganizationStructuredData } from '@/components/seo/structured-data';
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

const BASE_URL = 'https://pixeltec.mx';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'PixelTEC | Ecosistemas Digitales y Automatización',
    template: '%s | PixelTEC',
  },
  description: 'Transformamos procesos complejos en ecosistemas web y automatizaciones escalables para empresas que buscan rentabilidad y control absoluto.',
  keywords: ['desarrollo web México', 'automatización de procesos', 'CRM personalizado', 'consultoría tecnológica Puerto Vallarta', 'ecosistemas digitales', 'software a medida'],
  authors: [{ name: 'PixelTEC' }],
  icons: {
    icon: '/ptlogox.png',
    shortcut: '/ptlogox.png',
    apple: '/ptlogox.png',
  },
  other: {
    'theme-color': '#030303',
  },
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
          <SessionProvider>
            <FirebaseClientProvider>
              {children}
              <Toaster />
            </FirebaseClientProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
