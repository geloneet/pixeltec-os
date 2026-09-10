'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * WO-2026-00275 — marco común de las tres escenas: la firma que las une.
 *
 * Superficie negra fría (#06080d, ADR-0014 "negro profundo con matiz frío"),
 * retícula de 24 px al 2.5 % (guiño al fondo tipo Figma del Knowledge OS) y
 * una franja superior monoespaciada `● <sistema> · en vivo · simulación` con
 * reloj. La franja hace dos trabajos: vende que PixelTEC está operando ahora
 * mismo y declara con honestidad que los datos son ficticios (misma regla
 * que pixelbot-conversation-demo: "Conversación de demostración con datos
 * ficticios"). El cian solo aparece donde algo está vivo.
 */
export const SCENE = {
  bg: '#06080d',
  live: '#22d3ee', // cian de marca (dark --brand)
  structure: '#3b82f6', // azul de estructura
  ok: '#34d399', // esmeralda = éxito / resuelto
  warn: '#f59e0b', // ámbar = "antes" / problema (solo diagnóstico)
  line: 'rgba(255,255,255,0.12)',
  text: 'rgba(255,255,255,0.78)',
  muted: 'rgba(255,255,255,0.45)',
} as const;

interface SceneFrameProps {
  /** Nombre del sistema que "está trabajando" — p. ej. "WhatsAgent". */
  system: string;
  /** Reloj hh:mm:ss (null = todavía no hidratado). */
  clock: string | null;
  /** Fotograma final sin timers (modal, reduced-motion). */
  still: boolean;
  /** Texto alternativo de la escena para lectores de pantalla. */
  label: string;
  children: ReactNode;
  className?: string;
}

export function SceneFrame({ system, clock, still, label, children, className }: SceneFrameProps) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn('absolute inset-0 overflow-hidden text-white', className)}
      style={{
        backgroundColor: SCENE.bg,
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* Franja "en vivo" — la firma común. aria-hidden: el role="img" ya
          describe la escena completa. */}
      <div
        aria-hidden="true"
        className="flex items-center justify-between gap-2 whitespace-nowrap px-3.5 pt-3 font-mono text-[9px] uppercase tracking-[0.14em]"
        style={{ color: SCENE.muted }}
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span className="relative inline-flex h-1.5 w-1.5 shrink-0">
            {!still && (
              <span
                className="absolute inline-flex h-full w-full rounded-full motion-safe:animate-ping"
                style={{ backgroundColor: SCENE.ok, opacity: 0.6 }}
              />
            )}
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: SCENE.ok }} />
          </span>
          <span className="truncate" style={{ color: SCENE.text }}>{system}</span>
          {/* "en vivo" solo desde sm: en una tarjeta de 358 px el punto que
              pulsa ya lo dice; "simulación" (la honestidad) se queda siempre. */}
          <span className="hidden sm:inline">· {still ? 'fotograma' : 'en vivo'}</span>
          <span>· simulación</span>
        </span>
        <span className="shrink-0 tabular-nums">{clock ?? '··:··:··'}</span>
      </div>

      {/* Zona de acción: arriba, para dejar el tercio inferior al texto de la
          tarjeta (título + preview, con su gradiente de contraste). */}
      <div aria-hidden="true" className="relative mx-auto mt-2 w-full max-w-[460px] px-3">
        {children}
      </div>
    </div>
  );
}
