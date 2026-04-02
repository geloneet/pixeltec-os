import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'Análisis de rendimiento y carga de trabajo de los proyectos de PixelTEC.',
};

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
