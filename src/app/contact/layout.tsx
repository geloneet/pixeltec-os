import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { BreadcrumbStructuredData } from '@/components/seo/structured-data';
import { SITE } from '@/lib/site-config';

export const metadata: Metadata = buildMetadata({
  path: '/contact',
  title: 'Contacto · Hablemos de tu proyecto',
  // L3 (WO-2026-00345): description con categoría + geo + CTA real.
  description: 'Escríbenos o agenda un diagnóstico gratuito con PixelTEC, estudio de desarrollo de software y automatización en Puerto Vallarta, Jalisco.',
});

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbStructuredData items={[
        { name: SITE.name, url: SITE.url },
        { name: 'Contacto', url: `${SITE.url}/contact` },
      ]} />
      {children}
    </>
  );
}
