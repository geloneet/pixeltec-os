'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { PROTECTED_PATHS } from '@/lib/routes/admin-routes';
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE_SECONDS,
  buildFirstTouch,
  mergeLastTouch,
  parseAttributionCookie,
  serializeAttribution,
} from '@/lib/analytics/attribution';
import { isContentPath } from '@/lib/seo-insights/config';

/**
 * Captura de atribución (WO-2026-00214).
 *
 * Escribe y mantiene la cookie first-party `pt_attr` (90 días, `SameSite=Lax`).
 * Vive en el layout raíz, después de `MetaPixel`: a diferencia del
 * `ContentTracker`, la atribución tiene que registrar TAMBIÉN las entradas por
 * páginas que no son contenido (la home, `/contact`, una landing de campaña),
 * porque el primer contacto puede haber sido cualquiera de ellas.
 *
 * `SameSite=Lax` y no `Strict`: la mayoría de las primeras visitas llegan por
 * un enlace externo (Google, un anuncio, un correo) y con `Strict` la cookie no
 * se enviaría en esa navegación — justo la que hay que atribuir. `Secure` sólo
 * en https, para que siga funcionando en `localhost`.
 *
 * Qué NUNCA guarda: IP, query strings completos, contenido de formularios ni la
 * ruta del referrer externo (sólo su host). Ver `attribution.ts`.
 */

function isPublicPath(pathname: string): boolean {
  return !PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function readCookie(name: string): string | null {
  try {
    const prefix = `${name}=`;
    const found = document.cookie.split('; ').find((c) => c.startsWith(prefix));
    return found ? found.slice(prefix.length) : null;
  } catch {
    return null;
  }
}

function writeCookie(name: string, value: string): void {
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${ATTRIBUTION_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  } catch {
    // Cookies bloqueadas: el lead se guarda sin atribución y ya. Nunca es un
    // error visible para el visitante.
  }
}

export function AttributionCapture() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isPublicPath(pathname)) return;

    const touch = buildFirstTouch(window.location.href, document.referrer, new Date());
    if (!touch) return;

    const existing = parseAttributionCookie(readCookie(ATTRIBUTION_COOKIE));
    // `mergeLastTouch` protege el first-touch: aunque esto corra en cada
    // navegación, el primer contacto sólo se escribe una vez.
    const next = mergeLastTouch(existing, touch, isContentPath(touch.path));
    writeCookie(ATTRIBUTION_COOKIE, serializeAttribution(next));
  }, [pathname]);

  return null;
}
