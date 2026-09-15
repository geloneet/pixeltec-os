import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { BreadcrumbStructuredData } from '@/components/seo/structured-data';
import { SITE } from '@/lib/site-config';

// L3 (WO-2026-00345): title con categoría + geo (antes «Nosotros · Quiénes
// somos», sin intención). El H1 vive en page.tsx (PR #136) y queda como está.
export const metadata: Metadata = buildMetadata({
  path: '/about',
  title: 'Quiénes somos · Software en Puerto Vallarta',
  description: 'Estudio de desarrollo de software en Puerto Vallarta: un arquitecto líder en cada proyecto y una red de especialistas que se integra según haga falta.',
});

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbStructuredData items={[
        { name: SITE.name, url: SITE.url },
        { name: 'Nosotros', url: `${SITE.url}/about` },
      ]} />
      {children}
    </>
  );
}
