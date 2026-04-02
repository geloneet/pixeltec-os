import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Soporte Técnico',
  description: 'Gestión de tickets de soporte técnico para clientes de PixelTEC.',
};

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
