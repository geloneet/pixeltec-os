import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Exploramos el futuro del desarrollo de software, la inteligencia artificial y la modernización empresarial a través de nuestros artículos y análisis.',
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
