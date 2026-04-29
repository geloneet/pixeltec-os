import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  path: '/contact',
  title: 'Contacto · Hablemos de tu proyecto',
  description: 'Iniciemos la transformación digital de tu negocio. Ponte en contacto con nuestro equipo de consultores en Puerto Vallarta para agendar un diagnóstico.',
});

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
