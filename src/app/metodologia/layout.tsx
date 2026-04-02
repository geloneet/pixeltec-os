import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Metodología',
  description: 'Descubre nuestro proceso de ingeniería estructurado, desde el diagnóstico y la arquitectura hasta el desarrollo ágil, el despliegue en la nube y la evolución continua con IA.',
};

export default function MetodologiaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
