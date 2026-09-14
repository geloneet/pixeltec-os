'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { useInView } from 'framer-motion';

/**
 * WO-2026-00275 — infraestructura común de las tres escenas de Servicios.
 *
 * Un paso = esperar `wait` ms y ejecutar `run` (normalmente un setState).
 * El programador es PAUSABLE: cuando la tarjeta sale del viewport o la
 * pestaña se oculta, se cancela el timer pendiente y se recuerda el índice;
 * al volver, retoma exactamente en el paso siguiente. Así las tres escenas
 * no gastan hilo principal fuera de pantalla y, una vez visibles, corren
 * solas ("tiempo real" para Miguel = arrancan al cargar, sin hover).
 */
export type TimelineStep = { wait: number; run: () => void };

export function useSceneTimeline(
  steps: TimelineStep[] | null,
  active: boolean,
  runKey: number,
  onEnd: () => void,
) {
  const index = useRef(0);
  const stepsRef = useRef(steps);
  const onEndRef = useRef(onEnd);
  stepsRef.current = steps;
  onEndRef.current = onEnd;

  useEffect(() => {
    index.current = 0;
  }, [runKey]);

  useEffect(() => {
    if (!active || !stepsRef.current) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const schedule = () => {
      const list = stepsRef.current;
      if (!list) return;
      if (index.current >= list.length) {
        onEndRef.current();
        return;
      }
      const step = list[index.current];
      timer = setTimeout(() => {
        if (cancelled) return;
        step.run();
        index.current += 1;
        schedule();
      }, step.wait);
    };

    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [active, runKey]);
}

// Ronda 2: se retiran `typeChars` / `typeWords` (tipeo tipo terminal) y el
// reloj `useSceneClock`. La dirección Spotify/Airbnb/Apple sustituye el
// typewriter por elementos que llegan completos con spring.

/** Un solo paso. */
export function at(wait: number, run: () => void): TimelineStep {
  return { wait, run };
}

/**
 * ¿Debe correr la escena? Solo si está en viewport (≥30 %), la pestaña es
 * visible y el usuario no pidió movimiento reducido. Con `poster` la escena
 * nunca corre: se pinta el fotograma final (modal de detalle).
 */
export function useSceneActive(ref: RefObject<Element>, poster: boolean) {
  const inView = useInView(ref, { amount: 0.3 });
  const [pageVisible, setPageVisible] = useState(true);
  // No se usa useReducedMotion() de framer: en el cliente devuelve el valor
  // real ya en el primer render y el servidor no lo conoce → el fotograma
  // final se renderizaba en cliente contra una escena vacía en el HTML y React
  // reportaba hydration mismatch. Se resuelve tras montar, como el resto del
  // estado de la escena (misma estrategia que el reloj).
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const sync = () => setPageVisible(!document.hidden);
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const still = poster || reduceMotion;
  return { active: !still && inView && pageVisible, still };
}
