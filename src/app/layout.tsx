import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase/client-provider';

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
    <html lang="en" className="dark scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&family=Roboto:wght@400;500;700&family=League+Spartan:wght@800&display=swap" rel="stylesheet" />
      </head>
      <body className={cn('font-body antialiased min-h-screen bg-background text-foreground')}>
        <FirebaseClientProvider>
          {children}
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
