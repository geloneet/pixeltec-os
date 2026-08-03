import type { Metadata } from 'next';

// Portal de clientes: privado. El Disallow de robots.ts impide RASTREAR, pero
// si la URL ya está indexada Google no puede leer un noindex que no existe —
// por eso el meta va aquí además del Disallow.
export const metadata: Metadata = {
  title: 'Portal de clientes',
  description: 'Acceso privado al portal de clientes de PixelTEC.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
