'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { PROTECTED_PATHS } from '@/lib/routes/admin-routes';
import { useConsent } from '@/hooks/use-consent';

/**
 * Pixel de Meta (Facebook Pixel) — solo páginas públicas y solo con permiso.
 *
 * PRV-01 / REN-04 (WO-2026-00268). Antes este componente montaba el snippet
 * inline de Meta en el primer render de cualquier ruta pública: `fbevents.js`
 * (~70 KB, dominio de terceros) entraba en la carga inicial y disparaba
 * `PageView` antes de que el visitante pudiera opinar. El `<noscript><img>`
 * hacía lo mismo incluso sin JavaScript, donde ni siquiera existe la
 * posibilidad de pedir consentimiento — por eso se retiró y no se sustituyó.
 *
 * Ahora no ocurre nada hasta que `ConsentBanner` guarda «granted»:
 *
 *  - El script se inyecta con `document.createElement`, desde código que ya
 *    es de confianza para la CSP; `'strict-dynamic'` (ver
 *    `src/lib/security/csp.ts`) propaga esa confianza, así que no hace falta
 *    nonce ni un `<Script>` inline.
 *  - Se carga una sola vez por sesión de página (`loadedRef`): una vez
 *    descargado `fbevents.js`, desmontarlo no lo descarga.
 *  - En App Router la navegación cliente no recarga el documento, así que el
 *    `PageView` de las soft navs se emite a mano, como antes.
 *
 * Las rutas de admin (PROTECTED_PATHS) siguen fuera: no hay razón de negocio
 * para reportarle a Meta las URLs del panel interno.
 */
export const META_PIXEL_ID = '1756151715518615';

const FBEVENTS_SRC = 'https://connect.facebook.net/en_US/fbevents.js';

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string; callMethod?: (...args: unknown[]) => void; push?: unknown };
    _fbq?: unknown;
  }
}

function isTrackedPath(pathname: string): boolean {
  return !PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Equivalente al snippet oficial de Meta, en TypeScript: deja `window.fbq`
 * listo (encolando llamadas) y descarga `fbevents.js` en paralelo, que al
 * cargar vacía la cola.
 */
function installFbq(): void {
  if (window.fbq) return;
  const queue: unknown[] = [];
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else queue.push(args);
  } as NonNullable<Window['fbq']>;
  fbq.queue = queue;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  window.fbq = fbq;
  window._fbq = fbq;

  const script = document.createElement('script');
  script.async = true;
  script.src = FBEVENTS_SRC;
  document.head.appendChild(script);
}

export function MetaPixel() {
  const pathname = usePathname();
  const { status } = useConsent();
  const tracked = isTrackedPath(pathname);
  const granted = status === 'granted';

  const loadedRef = useRef(false);
  useEffect(() => {
    if (!granted || !tracked || loadedRef.current) return;
    loadedRef.current = true;
    installFbq();
    window.fbq?.('init', META_PIXEL_ID);
    window.fbq?.('track', 'PageView');
  }, [granted, tracked]);

  // PageView en soft navs. El primero lo emite el efecto de arriba al cargar,
  // por eso la ruta en la que se dio el consentimiento no se re-reporta aquí.
  const prevPathname = useRef<string | null>(null);
  useEffect(() => {
    if (prevPathname.current === pathname) return;
    const isFirst = prevPathname.current === null;
    prevPathname.current = pathname;
    if (isFirst) return;
    if (granted && tracked && typeof window.fbq === 'function') {
      window.fbq('track', 'PageView');
    }
  }, [pathname, granted, tracked]);

  return null;
}
