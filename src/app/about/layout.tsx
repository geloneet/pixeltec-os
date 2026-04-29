import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  path: '/about',
  title: 'Nosotros · Quiénes somos',
  description: 'Conoce al equipo de PixelTEC, nuestra metodología y cómo convertimos desafíos en ventajas competitivas a través de la tecnología.',
});

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
