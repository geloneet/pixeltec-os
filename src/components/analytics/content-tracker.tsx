'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { PROTECTED_PATHS } from '@/lib/routes/admin-routes';
import {
  SCROLL_DEPTHS,
  type ClientEventName,
  type CtaKind,
  type CtaPosition,
  type ScrollDepth,
} from '@/lib/analytics/events';

/**
 * Tracker de comportamiento de contenido (WO-2026-00214).
 *
 * Mide qué se lee y qué se pulsa en las piezas de contenido público (artículos
 * del blog y landings de keyword). Cero cookies de terceros, cero PII: el único
 * identificador es un uuid v4 en `sessionStorage` que muere al cerrar la
 * pestaña.
 *
 * Se monta en `src/app/blog/layout.tsx` y en `keyword-landing-page.tsx`, no en
 * el layout raíz: sólo esas dos superficies son "contenido" para este módulo, y
 * montarlo global significaría emitir eventos desde el checkout de contacto o
 * el wizard del diagnóstico, donde el path no representa una pieza de contenido.
 *
 * Las rutas protegidas quedan fuera con el mismo criterio que `meta-pixel.tsx`
 * (`PROTECTED_PATHS`): no hay razón para instrumentar el panel interno.
 *
 * Diseño: docs/superpowers/specs/2026-09-03-seo-contenido-design.md
 */

const SESSION_KEY = 'pt_sid';
const ENDPOINT = '/api/events';

/** Mismo criterio de exclusión que el pixel de Meta. */
function isTrackedPath(pathname: string): boolean {
  return !PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * uuid v4 de sesión. `sessionStorage` y no `localStorage` a propósito: la
 * sesión es la unidad de análisis y no debe sobrevivir al cierre de la pestaña
 * — un identificador persistente empezaría a parecerse a un perfil de persona,
 * que es justo lo que este diseño evita.
 *
 * En modo privado sin storage devuelve un id efímero: se pierde el dedupe entre
 * recargas, pero contar de más una vez es mejor que perder la sesión entera.
 */
function getSessionId(): string | null {
  const fresh = (): string | null => {
    try {
      return crypto.randomUUID();
    } catch {
      return null;
    }
  };
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) return stored;
    const created = fresh();
    if (created) sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return fresh();
  }
}

/**
 * Envío fire-and-forget. `sendBeacon` primero porque sobrevive a la descarga de
 * la página (un `cta_click` que navega fuera se perdería con un `fetch`
 * normal); `keepalive` como respaldo donde no exista.
 */
function send(payload: Record<string, unknown>): void {
  const body = JSON.stringify(payload);
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
  } catch {
    // Cae al fetch de abajo.
  }
  void fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

/**
 * Emisor suelto para superficies que no monta el tracker (por ejemplo el wizard
 * del diagnóstico). Es una función, no un hook, para poder llamarse desde un
 * handler sin arrastrar el ciclo de vida del componente.
 */
export function trackContentEvent(
  event: ClientEventName,
  path: string,
  meta?: Record<string, unknown>
): void {
  const sessionId = getSessionId();
  if (!sessionId) return;
  send({ sessionId, path: path.split('?')[0].split('#')[0], event, meta });
}

export function ContentTracker() {
  const pathname = usePathname();

  // Hitos ya emitidos en ESTA vista. Se reinicia con cada cambio de path: en
  // App Router la navegación cliente no recarga el documento, así que sin esto
  // el segundo artículo de la sesión heredaría los hitos del primero y no
  // emitiría nada.
  const sentDepths = useRef<Set<number>>(new Set());
  const sentView = useRef<string | null>(null);

  useEffect(() => {
    if (!isTrackedPath(pathname)) return;

    sentDepths.current = new Set();
    const sessionId = getSessionId();
    if (!sessionId) return;

    const path = pathname;
    const emit = (event: ClientEventName, meta?: Record<string, unknown>) =>
      send({ sessionId, path, event, meta });

    // ── view ─────────────────────────────────────────────────────────────
    // Una sola vez por path por montaje. El dedupe duro (una vista por sesión)
    // lo hace el índice único de la base — el guard de aquí sólo evita el
    // tráfico redundante de un re-render.
    if (sentView.current !== path) {
      sentView.current = path;
      emit('view');
    }

    // ── scroll ───────────────────────────────────────────────────────────
    // Throttle por rAF: el evento de scroll dispara decenas de veces por
    // segundo y calcular la altura del documento en cada uno fuerza reflow.
    let ticking = false;
    const measure = () => {
      ticking = false;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      // Página que no da scroll: se considera leída entera en cuanto se ve.
      const percent = scrollable <= 0 ? 100 : ((window.scrollY || doc.scrollTop) / scrollable) * 100;

      for (const depth of SCROLL_DEPTHS) {
        if (percent >= depth && !sentDepths.current.has(depth)) {
          sentDepths.current.add(depth);
          emit('scroll', { depth: depth satisfies ScrollDepth });
        }
      }
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(measure);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    // Primera medición: una página corta puede empezar ya por encima del 25 %.
    measure();

    // ── cta_click ────────────────────────────────────────────────────────
    // Delegación en el documento, no un handler por botón: marcar un CTA nuevo
    // es añadirle `data-cta`, sin tocar ningún componente de React. `closest`
    // resuelve el clic sobre el icono o el <span> interno del botón.
    const onClick = (ev: MouseEvent) => {
      const target = ev.target as Element | null;
      const el = target?.closest?.('[data-cta]') as HTMLElement | null;
      if (!el) return;
      const cta = el.dataset.cta;
      const position = el.dataset.ctaPos;
      if (!cta || !position) return;
      emit('cta_click', { cta: cta as CtaKind, position: position as CtaPosition });
    };
    document.addEventListener('click', onClick, { capture: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onClick, { capture: true });
    };
  }, [pathname]);

  return null;
}
