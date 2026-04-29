import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { Poppins, Roboto, League_Spartan } from 'next/font/google';
import { OrganizationStructuredData } from '@/components/seo/structured-data';

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
  keywords: ['automatización', 'desarrollo web', 'agencias', 'nextjs', 'firebase', 'consultoría tecnológica'],
  authors: [{ name: 'PixelTEC' }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-MX" className={cn('dark scroll-smooth', poppins.variable, roboto.variable, leagueSpartan.variable)}>
      <body className={cn('font-body antialiased min-h-screen bg-background text-foreground')}>
        <OrganizationStructuredData />
        <FirebaseClientProvider>
          {children}
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
