import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  path: '/data-deletion',
  title: 'Eliminación de Datos · Solicita la remoción de tu información',
  description: 'Cómo solicitar la eliminación de tus datos personales de los servicios de PixelTEC, en cumplimiento con la LFPDPPP.',
});

export default function DataDeletionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
