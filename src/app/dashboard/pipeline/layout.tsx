import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sales Pipeline',
  description: 'Gestión del pipeline de ventas y seguimiento de leads de PixelTEC.',
};

export default function PipelineLayout({ children }: { children: React.ReactNode }) {
  return children;
}
