'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { EASE_OUT, ENTER, PANEL, SCENE, SPRING, SPRING_SETTLE, SceneFrame, type SceneProps } from './scene-frame';
import { at, useSceneActive, useSceneTimeline, type TimelineStep } from './use-scene-timeline';

/**
 * WO-2026-00275 · Servicio "Consultoría & Soporte TI" · ronda 2.
 *
 * Antes (ronda 1): PIX como robot de trazos (círculo con carita, antena,
 * brazos y piernas de palito) señalando un diagrama de cajas y flechas que se
 * reordenaba. Veredicto de Miguel: "de juguete".
 * Ahora se conserva el concepto —una presencia que acompaña y presenta un
 * diagnóstico— pero con la fidelidad de un producto:
 *  - PIX es una cabeza de material oscuro con dos ojos de luz de marca (sin
 *    antena, sin extremidades, sin sonrisa dibujada). Comunica atención con
 *    la MIRADA: los ojos se desplazan hacia lo que está presentando y
 *    asiente al cerrar cada punto del plan. Parpadea (CSS, fuera del hilo).
 *  - Lo que presenta es un panel de diagnóstico limpio: áreas con barra de
 *    salud, la débil en ámbar; PIX la enfoca, la barra sube a cian, aparece
 *    la métrica protagonista ("−38 %") y se marca el plan. Nada de flechas.
 * Tres diagnósticos rotan: procesos, seguridad, UX.
 */

type Look = 'rest' | 'row' | 'kpi' | 'plan';

type Row = { label: string; before: number; after: number };
type Board = {
  title: string;
  rows: Row[]; // 4 filas; `weak` es la que se arregla
  weak: number;
  kpi: { value: (p: number) => string; label: string };
  say: [string, string, string];
};

const BOARDS: Board[] = [
  {
    title: 'Diagnóstico · Procesos',
    rows: [
      { label: 'Solicitud', before: 92, after: 92 },
      { label: 'Captura', before: 84, after: 86 },
      { label: 'Aprobación', before: 31, after: 90 },
      { label: 'Entrega', before: 78, after: 82 },
    ],
    weak: 2,
    kpi: { value: (p) => `−${Math.round(38 * p)} %`, label: 'tiempo de ciclo' },
    say: ['Aquí está el cuello de botella.', 'Así queda el flujo.', 'Plan de 90 días listo.'],
  },
  {
    title: 'Auditoría · Seguridad',
    rows: [
      { label: 'Sitio web', before: 96, after: 96 },
      { label: 'API', before: 90, after: 92 },
      { label: 'Base de datos', before: 88, after: 90 },
      { label: 'Accesos', before: 24, after: 95 },
    ],
    weak: 3,
    kpi: { value: (p) => (p >= 1 ? 'A+' : p >= 0.66 ? 'A' : p >= 0.33 ? 'B' : 'C'), label: 'calificación de seguridad' },
    say: ['Esta puerta está abierta.', 'Cerrada y monitoreada.', 'Auditoría entregada.'],
  },
  {
    title: 'Rediseño · Experiencia',
    rows: [
      { label: 'Landing', before: 88, after: 90 },
      { label: 'Formulario', before: 29, after: 86 },
      { label: 'Pago', before: 74, after: 80 },
      { label: 'Confirmación', before: 90, after: 92 },
    ],
    weak: 1,
    kpi: { value: (p) => `+${Math.round(64 * p)} %`, label: 'conversión' },
    say: ['Aquí se pierde a la gente.', 'Tres pasos, no siete.', 'Rediseño en marcha.'],
  },
];

type State = {
  phase: 'idle' | 'before' | 'after';
  focus: boolean; // fila débil enfocada
  say: string | null;
  look: Look;
  kpiP: number; // 0..1
  ticks: number; // 0..3
  nod: number;
};

const EMPTY: State = { phase: 'idle', focus: false, say: null, look: 'rest', kpiP: 0, ticks: 0, nod: 0 };

type Setter = (update: (prev: State) => State) => void;

function buildSteps(board: Board, set: Setter): TimelineStep[] {
  const s: TimelineStep[] = [];
  s.push(at(400, () => set((p) => ({ ...p, phase: 'before', say: board.say[0] }))));
  s.push(at(1100, () => set((p) => ({ ...p, focus: true, look: 'row' }))));
  s.push(at(2200, () => set((p) => ({ ...p, phase: 'after', say: board.say[1] }))));
  s.push(at(1500, () => set((p) => ({ ...p, focus: false, look: 'kpi' }))));
  for (let k = 1; k <= 10; k++) {
    s.push(at(k === 1 ? 250 : 70, () => set((p) => ({ ...p, kpiP: k / 10 }))));
  }
  s.push(at(600, () => set((p) => ({ ...p, look: 'plan' }))));
  for (let t = 1; t <= 3; t++) {
    s.push(at(t === 1 ? 350 : 520, () => set((p) => ({ ...p, ticks: t, nod: p.nod + 1 }))));
  }
  s.push(at(450, () => set((p) => ({ ...p, say: board.say[2], look: 'rest' }))));
  return s;
}

function posterState(board: Board): State {
  let st: State = EMPTY;
  const set: Setter = (u) => {
    st = u(st);
  };
  buildSteps(board, set).forEach((step) => step.run());
  return st;
}

/** Hacia dónde miran los ojos (desplazamiento en px dentro del SVG de PIX). */
const GAZE: Record<Look, { x: number; y: number }> = {
  rest: { x: 0, y: 0 },
  row: { x: 3.5, y: 0.5 },
  kpi: { x: 1.5, y: 3 },
  plan: { x: 3.5, y: 3 },
};

export function ConsultingMascotBg({ poster = false, layout, stageClassName }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { active, still } = useSceneActive(ref, poster);

  const [boardIndex, setBoardIndex] = useState(0);
  const [runKey, setRunKey] = useState(0);
  const [state, setState] = useState<State>(EMPTY);
  const [fading, setFading] = useState(false);

  const board = BOARDS[boardIndex];
  const steps = useMemo(() => {
    if (still) return null;
    const list = buildSteps(board, setState);
    list.push(at(3400, () => setFading(true)));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, still, runKey]);

  const onEnd = useCallback(() => {
    window.setTimeout(() => {
      setState(EMPTY);
      setFading(false);
      setBoardIndex((i) => (i + 1) % BOARDS.length);
      setRunKey((k) => k + 1);
    }, 560);
  }, []);

  useSceneTimeline(steps, active, runKey, onEnd);

  const poster0 = useMemo(() => (still ? posterState(BOARDS[0]) : null), [still]);
  const view = poster0 ?? state;
  const shown = still ? BOARDS[0] : board;
  const after = view.phase === 'after';
  const gaze = GAZE[view.look];

  return (
    <div ref={ref} className="absolute inset-0">
      <SceneFrame layout={layout} stageClassName={stageClassName} label="Simulación con datos ficticios de una consultoría: PIX, la presencia de PixelTEC, presenta un diagnóstico donde el área débil de un negocio se fortalece, con una métrica que mejora y un plan de 90 días que se va cumpliendo.">
        <motion.div
          className="grid h-[232px] grid-cols-[118px_1fr] gap-3"
          animate={{ opacity: fading ? 0 : 1 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
        >
          {/* ---------- PIX ---------- */}
          <div className="flex flex-col items-center pt-3">
            <Pix gaze={gaze} nod={view.nod} still={still} done={view.ticks >= 3} />
            {view.say && (
              <motion.p
                key={view.say}
                {...(still ? {} : ENTER)}
                className="mt-4 text-center text-[10px] font-medium leading-[1.35] tracking-[-0.005em]"
                style={{ color: SCENE.text }}
              >
                {view.say}
              </motion.p>
            )}
          </div>

          {/* ---------- Panel de diagnóstico ---------- */}
          <div className="flex flex-col overflow-hidden rounded-[18px] px-3.5 pb-3 pt-3" style={PANEL}>
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-semibold tracking-[-0.005em]" style={{ color: SCENE.text }}>
                {shown.title}
              </span>
              {view.phase !== 'idle' && (
                <motion.span
                  key={view.phase}
                  {...(still ? {} : ENTER)}
                  className="rounded-full px-2 py-[3px] text-[7.5px] font-semibold"
                  style={
                    after
                      ? { background: 'rgba(34,211,238,0.14)', color: SCENE.brand }
                      : { background: 'rgba(251,191,36,0.14)', color: SCENE.warn }
                  }
                >
                  {after ? 'Optimizado' : 'En revisión'}
                </motion.span>
              )}
            </div>

            <div className="mt-2.5 flex flex-col gap-[7px]">
              {shown.rows.map((row, i) => {
                const isWeak = i === shown.weak;
                const show = view.phase !== 'idle';
                const value = after ? row.after : row.before;
                const weakNow = isWeak && !after;
                const focused = view.focus && isWeak;
                return (
                  <motion.div
                    key={row.label}
                    className="relative grid grid-cols-[64px_1fr_28px] items-center gap-2 rounded-lg px-1.5 py-[3px]"
                    initial={still ? false : { opacity: 0, y: 6 }}
                    animate={{
                      opacity: show ? 1 : 0,
                      y: show ? 0 : 6,
                      backgroundColor: focused ? 'rgba(251,191,36,0.10)' : 'rgba(251,191,36,0)',
                    }}
                    transition={{ ...SPRING, delay: show ? i * 0.06 : 0, backgroundColor: { duration: 0.3 } }}
                  >
                    <span className="truncate text-[8.5px] font-medium" style={{ color: focused ? SCENE.text : SCENE.text2 }}>
                      {row.label}
                    </span>
                    <span className="relative h-[5px] overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <motion.span
                        className="absolute inset-y-0 left-0 w-full rounded-full"
                        style={{ transformOrigin: 'left' }}
                        initial={still ? false : { scaleX: 0 }}
                        animate={{
                          scaleX: show ? value / 100 : 0,
                          background: weakNow
                            ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                            : 'linear-gradient(90deg, #2563eb, #22d3ee)',
                        }}
                        transition={{ scaleX: { ...SPRING_SETTLE, duration: 0.9, delay: show ? i * 0.06 : 0 }, background: { duration: 0.4 } }}
                      />
                    </span>
                    <motion.span
                      className="text-right text-[8.5px] font-semibold tabular-nums"
                      animate={{ color: weakNow ? SCENE.warn : SCENE.text }}
                      transition={{ duration: 0.3 }}
                    >
                      {value}
                    </motion.span>
                  </motion.div>
                );
              })}
            </div>

            <div className="mt-auto flex items-end justify-between gap-3 pt-2">
              {/* Métrica protagonista */}
              <div className="min-w-0">
                {view.kpiP > 0 && (
                  <motion.div {...(still ? {} : ENTER)}>
                    <p className="text-[20px] font-semibold leading-none tracking-[-0.02em] tabular-nums" style={{ color: SCENE.text }}>
                      {shown.kpi.value(view.kpiP)}
                    </p>
                    <p className="mt-1 text-[8px] leading-none" style={{ color: SCENE.muted }}>
                      {shown.kpi.label}
                    </p>
                  </motion.div>
                )}
              </div>
              {/* Plan */}
              {view.kpiP >= 1 && (
                <motion.ul {...(still ? {} : ENTER)} className="flex shrink-0 flex-col gap-[5px]">
                  {['Diagnóstico', 'Plan de 90 días', 'Acompañamiento'].map((item, i) => {
                    const done = view.ticks > i;
                    return (
                      <li key={item} className="flex items-center gap-1.5">
                        <span className="relative flex h-[11px] w-[11px] items-center justify-center">
                          <motion.span
                            className="absolute inset-0 rounded-full"
                            style={{ borderWidth: 1.25, borderStyle: 'solid' }}
                            animate={{
                              backgroundColor: done ? 'rgba(52,211,153,0.18)' : 'rgba(255,255,255,0)',
                              borderColor: done ? 'rgba(52,211,153,0.6)' : 'rgba(255,255,255,0.25)',
                            }}
                            transition={{ duration: 0.3 }}
                          />
                          {done && (
                            <svg viewBox="0 0 12 12" className="relative h-[11px] w-[11px]" aria-hidden="true">
                              <motion.path
                                d="M3.4 6.2 L5.3 8 L8.7 4.3"
                                fill="none"
                                stroke={SCENE.ok}
                                strokeWidth={1.5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                initial={still ? false : { pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ duration: 0.28, ease: EASE_OUT }}
                              />
                            </svg>
                          )}
                        </span>
                        <span className="text-[8px] font-medium" style={{ color: done ? SCENE.text : SCENE.muted }}>
                          {item}
                        </span>
                      </li>
                    );
                  })}
                </motion.ul>
              )}
            </div>
          </div>
        </motion.div>
      </SceneFrame>
    </div>
  );
}

/**
 * PIX · ronda 2. Cabeza de material oscuro (gradiente + brillo superior de
 * 1 px + sombra blanda), dos ojos de luz de marca que miran hacia lo que se
 * presenta (spring), parpadeo CSS (.pix-eye) y un asentimiento breve al
 * cerrar cada punto del plan. Sin antena, sin extremidades, sin sonrisa
 * dibujada: la calidez la dan la luz y la mirada, no la caricatura.
 */
function Pix({ gaze, nod, still, done }: { gaze: { x: number; y: number }; nod: number; still: boolean; done: boolean }) {
  return (
    <div className="relative">
      {/* Halo de marca detrás de la cabeza */}
      <span
        className="absolute left-1/2 top-1/2 h-[92px] w-[92px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.22) 0%, rgba(34,211,238,0) 70%)', filter: 'blur(6px)' }}
      />
      <motion.svg
        viewBox="0 0 72 72"
        className="relative h-[74px] w-[74px]"
        key={`nod-${nod}`}
        animate={nod > 0 && !still ? { y: [0, 3, 0, 1.5, 0] } : { y: 0 }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
        style={{ filter: 'drop-shadow(0 14px 22px rgba(0,0,0,0.55))' }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="pix-face" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" stopColor="#1d2735" />
            <stop offset="1" stopColor="#0a0f16" />
          </linearGradient>
          <linearGradient id="pix-eye" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a5f3fc" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
          <filter id="pix-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Cabeza */}
        <rect x={6} y={10} width={60} height={52} rx={18} fill="url(#pix-face)" stroke="rgba(255,255,255,0.14)" strokeWidth={1} />
        {/* Brillo superior: la luz que toca el material */}
        <path d="M18 11.5 h36 a12 12 0 0 1 10 6" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={1} strokeLinecap="round" />
        {/* Ojos: miran hacia lo que PIX presenta */}
        <motion.g
          initial={still ? false : { x: gaze.x, y: gaze.y }}
          animate={{ x: gaze.x, y: gaze.y }}
          transition={SPRING}
          filter="url(#pix-glow)"
        >
          <rect x={22} y={28} width={8} height={14} rx={4} fill="url(#pix-eye)" className={still ? undefined : 'pix-eye'} />
          <rect x={42} y={28} width={8} height={14} rx={4} fill="url(#pix-eye)" className={still ? undefined : 'pix-eye'} />
        </motion.g>
        {/* Gesto mínimo: una línea de luz tenue que se curva al terminar */}
        <motion.path
          fill="none"
          stroke="rgba(165,243,252,0.55)"
          strokeWidth={1.5}
          strokeLinecap="round"
          initial={false}
          animate={{ d: done ? 'M31 50 Q36 53.5 41 50' : 'M32 50.5 Q36 51 40 50.5' }}
          transition={SPRING}
        />
      </motion.svg>
    </div>
  );
}
