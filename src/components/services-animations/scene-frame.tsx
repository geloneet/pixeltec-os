'use client';

import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * WO-2026-00275 · ronda 2 — marco común de las tres escenas.
 *
 * Dirección "producto, no consola" (veredicto de Miguel: menos juguete, más
 * Spotify / Airbnb / Apple). Lo que cambia respecto a la ronda 1:
 *  - Fuera la franja monoespaciada `● en vivo · simulación` con reloj y la
 *    retícula técnica de 24 px: la honestidad de "son datos ficticios" vive en
 *    el `aria-label` de cada escena y en una línea discreta del modal.
 *  - Entra un solo foco de luz de marca (radial cian→azul, arriba) sobre el
 *    negro frío de ADR-0014. El cian sigue siendo acento, nunca superficie.
 *  - Los paneles son "material": gradiente tonal suave, brillo de 1 px en el
 *    borde superior (la luz que toca el material) y sombra larga y blanda.
 *    Nada de bordes neón.
 *  - Tipografía: la sans del sitio (Poppins) en pesos 500/600. Cero monospace.
 *  - Movimiento: springs críticamente amortiguados (Apple: damping 1.0,
 *    response ≈ 0.4–0.55) para todo lo que entra; crossfades para reemplazar
 *    contenido. Sin typewriter ni cursores parpadeando.
 */
export const SCENE = {
  bg: '#06080d',
  brand: '#22d3ee', // cian de marca (dark --brand)
  brandDeep: '#3b82f6', // azul de estructura
  ok: '#34d399', // esmeralda = resuelto
  warn: '#fbbf24', // ámbar = "antes" (solo diagnóstico)
  text: 'rgba(255,255,255,0.92)',
  text2: 'rgba(255,255,255,0.64)',
  muted: 'rgba(255,255,255,0.42)',
  hairline: 'rgba(255,255,255,0.08)',
} as const;

/** Spring por defecto: sin rebote, se asienta con gracia (Apple damping 1.0). */
export const SPRING = { type: 'spring', duration: 0.55, bounce: 0 } as const;
/** Spring para lo que "aterriza" con algo de peso (tarjetas grandes). */
export const SPRING_SETTLE = { type: 'spring', duration: 0.7, bounce: 0.08 } as const;
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** Entrada estándar de un elemento: sube 8 px y se asienta. */
export const ENTER = {
  initial: { opacity: 0, y: 8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: SPRING,
} as const;

/** Estilo de panel "material" (superficie elevada sobre el negro frío). */
export const PANEL: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(255,255,255,0.075) 0%, rgba(255,255,255,0.035) 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.09), 0 24px 48px -24px rgba(0,0,0,0.75)',
  border: '1px solid rgba(255,255,255,0.06)',
};

/** Superficie de dispositivo (pantalla de teléfono / ventana): más oscura y lisa. */
export const DEVICE: CSSProperties = {
  background: 'linear-gradient(180deg, #121821 0%, #0b1017 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), 0 28px 56px -28px rgba(0,0,0,0.85)',
  border: '1px solid rgba(255,255,255,0.08)',
};

/**
 * WO-2026-00341 — dónde vive la escena decide cómo se coloca la composición
 * (460 × 248 px de diseño):
 *  - `card` (home): anclada arriba; el tercio inferior queda libre para el
 *    título y el preview de la tarjeta, que van encima con su gradiente.
 *  - `stage` (modal, hero de /services/[slug], tarjetas de /services): la
 *    composición es la protagonista, centrada en su caja y escalable con
 *    `zoom` desde `stageClassName` (p. ej. `md:[zoom:1.25]`). `zoom` escala
 *    también el layout —no solo el pintado— así que el escenario crece sin
 *    reescribir los píxeles afinados de cada escena. Si la caja es más
 *    angosta que 460 × zoom, la composición se comprime igual que en móvil.
 */
export type SceneLayout = 'card' | 'stage';

/** Props comunes de las tres escenas (`WhatsappAiAgentBg`, `SiteAppBuildBg`, `ConsultingMascotBg`). */
export interface SceneProps {
  /** Fotograma final, sin timers (también se fuerza bajo prefers-reduced-motion). */
  poster?: boolean;
  layout?: SceneLayout;
  /** Clases para la caja de la composición en modo `stage` (zoom responsivo). */
  stageClassName?: string;
}

interface SceneFrameProps {
  /** Texto alternativo de la escena para lectores de pantalla (declara la simulación). */
  label: string;
  children: ReactNode;
  className?: string;
  layout?: SceneLayout;
  stageClassName?: string;
}

export function SceneFrame({ label, children, className, layout = 'card', stageClassName }: SceneFrameProps) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn('absolute inset-0 overflow-hidden font-sans text-white antialiased', className)}
      style={{
        backgroundColor: SCENE.bg,
        backgroundImage:
          'radial-gradient(120% 70% at 50% -12%, rgba(34,211,238,0.16) 0%, rgba(59,130,246,0.07) 42%, transparent 72%)',
      }}
    >
      {layout === 'stage' ? (
        // Escenario: la composición centrada en su caja, con aire alrededor.
        <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
          <div className={cn('w-full max-w-[460px] px-4 pt-4', stageClassName)}>{children}</div>
        </div>
      ) : (
        // Zona de acción: arriba, para dejar el tercio inferior al texto de la
        // tarjeta (título + preview, con su gradiente de contraste).
        <div aria-hidden="true" className="relative mx-auto w-full max-w-[460px] px-4 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}
