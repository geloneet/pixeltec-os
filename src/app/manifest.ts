import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site-config';

/**
 * Web App Manifest (SEO-07, WO-2026-00268).
 *
 * Convención de Next: este archivo se sirve en `/manifest.webmanifest` y el
 * `<link rel="manifest">` lo inyecta el framework — no hay que declararlo en
 * el layout. Los iconos son los mismos archivos de la convención de `src/app`
 * (`icon.png` 512×512, `apple-icon.png` 180×180 opaco), así no hay una
 * segunda copia del logo que se pueda desincronizar.
 *
 * `theme_color` se mantiene igual al `viewport.themeColor` del layout raíz:
 * si divergen, Android pinta la barra de un color y el navegador de otro.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE.name} · Ecosistemas Digitales y Automatización`,
    short_name: SITE.name,
    description: SITE.description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#030303',
    theme_color: '#030303',
    lang: SITE.locale,
    dir: 'ltr',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
