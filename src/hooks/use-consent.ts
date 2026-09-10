'use client';

import { useEffect, useState } from 'react';
import { CONSENT_EVENT, readConsent, type ConsentStatus } from '@/lib/analytics/consent';

/**
 * Estado del consentimiento de seguimiento (PRV-01, WO-2026-00268).
 *
 * Devuelve `'unknown'` en el servidor y en el primer render del cliente —
 * `localStorage` no existe durante el SSR, y leerlo antes de montar
 * provocaría un desajuste de hidratación. `mounted` distingue «todavía no lo
 * sé» de «ya lo leí y no hay decisión», que es lo que necesita el banner para
 * no parpadear en cada carga.
 *
 * Escucha el evento propio (misma pestaña) y `storage` (otras pestañas), para
 * que aceptar en una ventana aplique en todas sin recargar.
 */
export function useConsent(): { status: ConsentStatus; mounted: boolean } {
  const [status, setStatus] = useState<ConsentStatus>('unknown');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setStatus(readConsent());
    setMounted(true);

    const sync = () => setStatus(readConsent());
    window.addEventListener(CONSENT_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CONSENT_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return { status, mounted };
}
