'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useConsent } from '@/hooks/use-consent';
import { writeConsent } from '@/lib/analytics/consent';
import { isNoindexPath } from '@/lib/routes/admin-routes';

/**
 * Banner de consentimiento (PRV-01, WO-2026-00268).
 *
 * El sitio cargaba el Pixel de Meta y disparaba `PageView` en cuanto se
 * abría cualquier página pública, sin preguntar. Este banner recoge la
 * decisión y `MetaPixel` la respeta: sin «Aceptar» no se descarga
 * `fbevents.js` ni se envía nada a Meta.
 *
 * Decisiones de diseño:
 *
 * - `position: fixed` abajo: no participa del flujo, así que no puede
 *   desplazar contenido ni sumar CLS (REN-04 va precisamente de no
 *   empeorar las métricas al arreglar la privacidad).
 * - No se pinta hasta haber leído `localStorage` (`mounted`): renderizarlo
 *   en el servidor lo haría parpadear en cada carga de quien ya decidió.
 * - Dos botones con el mismo peso visual. Un «Rechazar» escondido o en gris
 *   claro es un patrón oscuro, y además invalida el consentimiento.
 * - Fuera del panel y de las pantallas de acceso: ahí no hay pixel que
 *   cargar (`MetaPixel` ya excluye esas rutas).
 */
export function ConsentBanner() {
  const { status, mounted } = useConsent();
  const pathname = usePathname();

  if (!mounted || status !== 'unknown') return null;
  if (isNoindexPath(pathname)) return null;

  return (
    <div
      role="region"
      aria-label="Aviso de cookies y seguimiento"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 p-4 backdrop-blur-md sm:p-5"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Usamos herramientas de medición de terceros (Meta) para entender qué contenido
          resulta útil. No se carga nada hasta que lo aceptes.{' '}
          <Link href="/aviso-de-privacidad" className="text-brand underline underline-offset-4">
            Aviso de privacidad
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={() => writeConsent('denied')}
            className="inline-flex h-11 items-center rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Rechazar
          </button>
          <button
            type="button"
            onClick={() => writeConsent('granted')}
            className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
