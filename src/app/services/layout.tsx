import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  path: '/services',
  title: 'Servicios · Soluciones de alto impacto',
  description: 'Descubre nuestras soluciones de alto impacto: Ecosistemas Web Avanzados, Automatización de Procesos y Consultoría Tecnológica para modernizar tu empresa.',
});

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
