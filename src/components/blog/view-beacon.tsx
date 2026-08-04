'use client';

import { useEffect } from 'react';

/**
 * Marca UNA visita por artículo por sesión de navegador (sessionStorage evita
 * inflar con recargas). Fire-and-forget: si el beacon falla, el artículo no se
 * entera. Necesario en cliente porque la página es ISR y el server render no
 * corre por visita.
 */
export function ViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `pixeltec-view:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // Modo privado sin storage: cuenta igual (mejor contar de más una vez
      // que perder la visita).
    }
    void fetch('/api/blog/view', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug }),
      keepalive: true,
    }).catch(() => undefined);
  }, [slug]);

  return null;
}
