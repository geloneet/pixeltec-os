import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nosotros',
  description: 'Conoce al equipo de PixelTEC, nuestra metodología y cómo convertimos desafíos en ventajas competitivas a través de la tecnología.',
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
