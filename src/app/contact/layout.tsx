import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contacto',
  description: 'Iniciemos la transformación digital de tu negocio. Ponte en contacto con nuestro equipo de consultores en Puerto Vallarta para agendar un diagnóstico.',
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
