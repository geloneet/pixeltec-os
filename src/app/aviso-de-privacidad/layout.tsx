import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  path: '/aviso-de-privacidad',
  title: 'Aviso de Privacidad · Tratamiento de tus datos',
  description: 'Cómo trata PixelTEC tus datos personales, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP).',
});

export default function AvisoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
