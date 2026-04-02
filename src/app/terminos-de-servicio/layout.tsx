import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Términos de Servicio',
  description: 'Consulta los términos y condiciones de servicio para los proyectos de desarrollo, automatización y consultoría de PixelTEC.',
};

export default function TerminosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
