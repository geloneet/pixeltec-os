'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * Decorado animado de la sección "Sobre nosotros". Frontera cliente mínima:
 * aquí vive lo único que necesita framer-motion, para que el H2, el párrafo y
 * el CTA de `AboutWaveSection` sigan siendo Server Component e indexables.
 *
 * Con `prefers-reduced-motion` los paths se pintan estáticos: la composición
 * visual se conserva, sin animación infinita.
 */
export function WaveDecoration() {
  const reduceMotion = useReducedMotion();

  const paths = [
    { d: 'M0,250 C320,350 420,100 720,200 C1020,300 1120,150 1440,200', stroke: 'url(#paint0_linear_intense)', width: '1', animate: { y: [0, -80, 0], x: [0, 40, 0], opacity: [0.2, 0.9, 0.2] }, duration: 5, delay: 0 },
    { d: 'M0,270 C320,370 420,120 720,220 C1020,320 1120,170 1440,220', stroke: 'url(#paint0_linear_intense)', width: '1', animate: { y: [0, -100, 0], x: [0, -30, 0], opacity: [0.3, 0.8, 0.3] }, duration: 7, delay: 0.3 },
    { d: 'M0,290 C320,390 420,140 720,240 C1020,340 1120,190 1440,240', stroke: 'url(#paint1_linear_intense)', width: '2', animate: { y: [0, -60, 0], x: [0, 50, 0], opacity: [0.4, 1, 0.4], strokeWidth: [2, 3, 2] }, duration: 4, delay: 0.1 },
    { d: 'M0,310 C320,410 420,160 720,260 C1020,360 1120,210 1440,260', stroke: 'url(#paint1_linear_intense)', width: '1.5', animate: { y: [0, -120, 0], x: [0, -60, 0], opacity: [0.2, 0.7, 0.2] }, duration: 8, delay: 0.5 },
    { d: 'M0,330 C320,430 420,180 720,280 C1020,380 1120,230 1440,280', stroke: 'url(#paint0_linear_intense)', width: '1', animate: { y: [0, -70, 0], x: [0, 30, 0], opacity: [0.3, 0.8, 0.3] }, duration: 6, delay: 0.8 },
  ];

  return (
    <div
      aria-hidden="true"
      className="absolute bottom-0 left-0 w-full h-[300px] sm:h-[400px] md:h-[500px] pointer-events-none opacity-30 dark:opacity-70"
    >
      <svg
        viewBox="0 0 1440 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full object-cover overflow-visible"
      >
        {paths.map((p) => (
          <motion.path
            key={p.d}
            d={p.d}
            stroke={p.stroke}
            strokeWidth={p.width}
            opacity={reduceMotion ? 0.55 : undefined}
            animate={reduceMotion ? undefined : p.animate}
            transition={
              reduceMotion
                ? undefined
                : { duration: p.duration, repeat: Infinity, ease: 'easeInOut', delay: p.delay }
            }
          />
        ))}
        <defs>
          <linearGradient id="paint0_linear_intense" x1="0" y1="250" x2="1440" y2="250" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00F0FF" stopOpacity="0" />
            <stop offset="0.5" stopColor="#00F0FF" stopOpacity="0.7" />
            <stop offset="1" stopColor="#00F0FF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="paint1_linear_intense" x1="0" y1="250" x2="1440" y2="250" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3b82f6" stopOpacity="0" />
            <stop offset="0.5" stopColor="#00F0FF" stopOpacity="1" />
            <stop offset="1" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
