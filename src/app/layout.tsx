import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { Poppins, Roboto, League_Spartan } from 'next/font/google';

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
  title: {
    default: 'PixelTEC | Ecosistemas Digitales y Automatización',
    template: '%s | PixelTEC',
  },
  description: 'Transformamos procesos complejos en ecosistemas web y automatizaciones escalables para empresas que buscan rentabilidad y control absoluto.',
  keywords: ['automatización', 'desarrollo web', 'agencias', 'nextjs', 'firebase', 'consultoría tecnológica'],
  authors: [{ name: 'PixelTEC' }],
  openGraph: {
    title: 'PixelTEC | Ecosistemas Digitales y Automatización',
    description: 'Transformamos procesos complejos en ecosistemas web y automatizaciones escalables para empresas que buscan rentabilidad y control absoluto.',
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn('dark scroll-smooth', poppins.variable, roboto.variable, leagueSpartan.variable)}>
      <body className={cn('font-body antialiased min-h-screen bg-background text-foreground')}>
        <FirebaseClientProvider>
          {children}
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
