import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Guías de Transformación',
  description: 'Accede a nuestro centro de recursos exclusivos: Playbooks, arquitecturas y estrategias confidenciales para escalar tu ecosistema digital.',
};

export default function GuiasLayout({ children }: { children: React.ReactNode }) {
  return children;
}
