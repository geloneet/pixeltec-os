import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  path: '/terminos-de-servicio',
  title: 'Términos de Servicio · Condiciones de nuestros proyectos',
  description: 'Consulta los términos y condiciones de servicio para los proyectos de desarrollo, automatización y consultoría de PixelTEC.',
});

export default function TerminosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
