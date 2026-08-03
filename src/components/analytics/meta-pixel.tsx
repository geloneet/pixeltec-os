'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { PROTECTED_PATHS } from '@/lib/routes/admin-routes';

/**
 * Pixel de Meta (Facebook Pixel) — solo páginas públicas.
 *
 * El snippet base de Meta emite un único PageView en la carga del documento,
 * pero en App Router la navegación cliente (soft nav) no recarga el documento:
 * sin el efecto de abajo, todo el recorrido posterior del visitante sería
 * invisible para el pixel. Las rutas de admin (PROTECTED_PATHS) quedan fuera:
 * no hay razón de negocio para reportar a Meta las URLs del panel interno.
 *
 * CSP: el snippet inline lleva el nonce del middleware; `strict-dynamic`
 * cubre la carga dinámica de fbevents.js y `src/lib/security/csp.ts` declara
 * los dominios de Meta como fallback (script-src) y destino de eventos
 * (connect-src).
 */
export const META_PIXEL_ID = '1756151715518615';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

function isTrackedPath(pathname: string): boolean {
  return !PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function MetaPixel({ nonce }: { nonce?: string }) {
  const pathname = usePathname();
  const tracked = isTrackedPath(pathname);

  // El snippet se monta la primera vez que el visitante pisa una ruta pública
  // (en el caso típico, ya en el HTML del servidor) y nunca se desmonta: una
  // vez cargado fbevents.js, descargarlo no lo "des-carga".
  const [shouldLoad, setShouldLoad] = useState(tracked);
  useEffect(() => {
    if (tracked) setShouldLoad(true);
  }, [tracked]);

  // PageView en soft navs. El primer PageView lo emite el propio snippet, por
  // eso la primera ruta observada no se re-reporta aquí.
  const prevPathname = useRef<string | null>(null);
  useEffect(() => {
    if (prevPathname.current === pathname) return;
    const isFirst = prevPathname.current === null;
    prevPathname.current = pathname;
    if (isFirst) return;
    if (tracked && typeof window.fbq === 'function') {
      window.fbq('track', 'PageView');
    }
  }, [pathname, tracked]);

  if (!shouldLoad) return null;

  return (
    <>
      <Script id="meta-pixel" nonce={nonce} strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
