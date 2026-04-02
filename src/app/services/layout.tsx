import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Servicios',
  description: 'Descubre nuestras soluciones de alto impacto: Ecosistemas Web Avanzados, Automatización de Procesos y Consultoría Tecnológica para modernizar tu empresa.',
};

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
