import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gestor de Tareas',
  description: 'Gestión de tareas globales de PixelTEC OS.',
};

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
