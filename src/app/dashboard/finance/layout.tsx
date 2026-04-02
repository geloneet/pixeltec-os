import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Finanzas',
  description: 'Gestión financiera y de ingresos de PixelTEC.',
};

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
