'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { SCENE, SceneFrame } from './scene-frame';
import { at, useSceneActive, useSceneClock, useSceneTimeline, type TimelineStep } from './use-scene-timeline';

/**
 * WO-2026-00275 · Servicio "Consultoría & Soporte TI".
 *
 * Decisión de diseño: se conserva la idea de Miguel — una mascota dando la
 * consultoría — porque la consultoría es el servicio humano de PixelTEC y un
 * personaje es lo que mejor comunica "acompañamiento". Se evalúó la
 * alternativa (solo un tablero de diagnóstico animado, sin personaje) y se
 * descartó: quedaba indistinguible de un dashboard genérico y perdía la
 * calidez que diferencia este servicio de los otros dos.
 *
 * Para que no salga infantil, PIX está construido con la misma gramática que
 * las otras escenas: un píxel redondeado con trazo cian como cabeza, ojos que
 * parpadean, un brazo que señala (línea con mano) y un cuerpo geométrico. Y lo
 * que presenta es real: un tablero donde un proceso enredado (ámbar) se
 * reordena en un flujo limpio (cian), con KPIs que cuentan y un plan que se
 * va marcando. Tres tableros rotan: procesos, seguridad, UX.
 */

type Target = 'rest' | 'bottleneck' | 'flow' | 'kpi' | 'plan';

type Kpi = { label: string; render: (p: number) => string };

type Board = {
  title: string;
  nodes: string[]; // 6: los 5 primeros forman la fila, el 6º es la rama
  bottleneck: number; // índice del nodo problemático
  tag: string; // etiqueta del problema
  kpis: [Kpi, Kpi];
  say: [string[], string[], string[]];
};

const BOARDS: Board[] = [
  {
    title: 'Diagnóstico · Procesos',
    nodes: ['Solicitud', 'Captura', 'Aprobación', 'Factura', 'Entrega', 'Excepción'],
    bottleneck: 2,
    tag: '3.4 días de espera',
    kpis: [
      { label: 'Tiempo de ciclo', render: (p) => `−${Math.round(38 * p)} %` },
      { label: 'Velocidad', render: (p) => `${(1 + 1.1 * p).toFixed(1)}×` },
    ],
    say: [['Aquí está el', 'cuello de botella.'], ['Así queda', 'el flujo.'], ['Plan de 90 días', 'listo.']],
  },
  {
    title: 'Auditoría · Seguridad',
    nodes: ['Web', 'API', 'Base datos', 'Backups', 'Accesos', 'Monitoreo'],
    bottleneck: 4,
    tag: 'sin 2FA · 3 puertos',
    kpis: [
      { label: 'Puertos expuestos', render: (p) => `${Math.round(3 - 3 * p)}` },
      { label: 'Calificación TLS', render: (p) => (p >= 1 ? 'A+' : p >= 0.6 ? 'A' : p >= 0.3 ? 'B' : 'C') },
    ],
    say: [['Esta puerta', 'está abierta.'], ['Cerrada y', 'monitoreada.'], ['Auditoría', 'entregada.']],
  },
  {
    title: 'Rediseño · UX',
    nodes: ['Landing', 'Formulario', 'Cotización', 'Pago', 'Confirmación', 'Soporte'],
    bottleneck: 1,
    tag: '71 % abandona aquí',
    kpis: [
      { label: 'Conversión', render: (p) => `+${Math.round(64 * p)} %` },
      { label: 'Pasos', render: (p) => `${Math.round(7 - 4 * p)} pasos` },
    ],
    say: [['Aquí se pierde', 'a la gente.'], ['Tres pasos,', 'no siete.'], ['Rediseño', 'en marcha.']],
  },
];

type State = {
  phase: 'idle' | 'before' | 'after';
  hot: boolean; // cuello de botella resaltado
  say: string[] | null;
  target: Target;
  kpiP: number; // 0..1
  ticks: number; // 0..3
  nod: number; // contador para replicar el asentimiento
};

const EMPTY: State = { phase: 'idle', hot: false, say: null, target: 'rest', kpiP: 0, ticks: 0, nod: 0 };

// Geometría del tablero (coordenadas del viewBox 460×224)
const NODE_W = 42;
const NODE_H = 16;
const BEFORE: [number, number][] = [
  [172, 58],
  [346, 40],
  [232, 124],
  [390, 146],
  [164, 152],
  [300, 84],
];
const ROW_Y = 96;
const AFTER: [number, number][] = [
  [156, ROW_Y],
  [214, ROW_Y],
  [272, ROW_Y],
  [330, ROW_Y],
  [388, ROW_Y],
  [272, 134],
];
const BEFORE_EDGES: [number, number][] = [
  [0, 3],
  [1, 4],
  [2, 5],
  [3, 1],
  [4, 0],
  [5, 2],
];

const center = (p: [number, number]): [number, number] => [p[0] + NODE_W / 2, p[1] + NODE_H / 2];

const SHOULDER: [number, number] = [58, 122];
const ARM = 36;
const PLAN_ROWS = [178, 190, 202];

function handFor(target: Target, board: Board): [number, number] {
  let aim: [number, number];
  switch (target) {
    case 'bottleneck':
      aim = center(BEFORE[board.bottleneck]);
      break;
    case 'flow':
      aim = center(AFTER[2]);
      break;
    case 'kpi':
      aim = [196, 186];
      break;
    case 'plan':
      aim = [352, PLAN_ROWS[2]];
      break;
    default:
      return [SHOULDER[0] + 4, SHOULDER[1] + ARM]; // brazo colgando
  }
  const dx = aim[0] - SHOULDER[0];
  const dy = aim[1] - SHOULDER[1];
  const len = Math.hypot(dx, dy) || 1;
  return [SHOULDER[0] + (dx / len) * ARM, SHOULDER[1] + (dy / len) * ARM];
}

type Setter = (update: (prev: State) => State) => void;

function buildSteps(board: Board, set: Setter): TimelineStep[] {
  const s: TimelineStep[] = [];
  s.push(at(400, () => set((p) => ({ ...p, phase: 'before', say: board.say[0], target: 'rest' }))));
  s.push(at(1100, () => set((p) => ({ ...p, hot: true, target: 'bottleneck' }))));
  s.push(at(2300, () => set((p) => ({ ...p, phase: 'after', hot: false, say: board.say[1], target: 'flow' }))));
  s.push(at(1500, () => set((p) => ({ ...p, target: 'kpi' }))));
  for (let k = 1; k <= 10; k++) {
    s.push(at(k === 1 ? 300 : 75, () => set((p) => ({ ...p, kpiP: k / 10 }))));
  }
  s.push(at(500, () => set((p) => ({ ...p, target: 'plan' }))));
  for (let t = 1; t <= 3; t++) {
    s.push(at(t === 1 ? 300 : 480, () => set((p) => ({ ...p, ticks: t, nod: p.nod + 1 }))));
  }
  s.push(at(400, () => set((p) => ({ ...p, say: board.say[2] }))));
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

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const SPRING = { type: 'spring' as const, duration: 0.7, bounce: 0.15 };

export function ConsultingMascotBg({ poster = false }: { poster?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { active, still } = useSceneActive(ref, poster);
  const clock = useSceneClock(active, still);

  const [boardIndex, setBoardIndex] = useState(0);
  const [runKey, setRunKey] = useState(0);
  const [state, setState] = useState<State>(EMPTY);
  const [fading, setFading] = useState(false);

  const board = BOARDS[boardIndex];
  const steps = useMemo(() => {
    if (still) return null;
    const list = buildSteps(board, setState);
    list.push(at(3200, () => setFading(true)));
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
  const positions = view.phase === 'after' ? AFTER : BEFORE;
  const hand = handFor(view.target, shown);

  return (
    <div ref={ref} className="absolute inset-0">
      <SceneFrame
        system="PIX · Consultoría"
        clock={clock}
        still={still}
        label="Simulación de una consultoría: la mascota PIX de PixelTEC presenta un tablero de diagnóstico donde un proceso desordenado se reordena en un flujo limpio, con indicadores que mejoran y un plan de 90 días que se va marcando."
      >
        <motion.svg
          viewBox="0 0 460 224"
          className="h-[224px] w-full"
          preserveAspectRatio="xMidYMin meet"
          animate={{ opacity: fading ? 0 : 1 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          style={{ fontFamily: 'inherit' }}
        >
          {/* ---------- Tablero ---------- */}
          <rect x={140} y={8} width={312} height={208} rx={10} fill="rgba(255,255,255,0.025)" stroke={SCENE.line} />
          <text x={152} y={25} fontSize={9} fontWeight={600} fill={SCENE.text}>
            {shown.title}
          </text>
          {view.phase !== 'idle' && (
            <motion.g
              key={view.phase}
              initial={still ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
            >
              <rect
                x={392}
                y={15}
                width={52}
                height={14}
                rx={7}
                fill={view.phase === 'after' ? 'rgba(34,211,238,0.12)' : 'rgba(245,158,11,0.12)'}
                stroke={view.phase === 'after' ? 'rgba(34,211,238,0.45)' : 'rgba(245,158,11,0.45)'}
              />
              <text
                x={418}
                y={25}
                textAnchor="middle"
                fontSize={7.5}
                fontWeight={600}
                fill={view.phase === 'after' ? SCENE.live : SCENE.warn}
              >
                {view.phase === 'after' ? 'después' : 'antes'}
              </text>
            </motion.g>
          )}

          {/* Aristas del enredo (antes) */}
          {view.phase !== 'idle' && (
            <motion.g animate={{ opacity: view.phase === 'before' ? 1 : 0 }} transition={{ duration: 0.4 }}>
              {BEFORE_EDGES.map(([a, b], i) => {
                const [x1, y1] = center(BEFORE[a]);
                const [x2, y2] = center(BEFORE[b]);
                return (
                  <motion.line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="rgba(255,255,255,0.22)"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    initial={still ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.2 + i * 0.06 }}
                  />
                );
              })}
            </motion.g>
          )}

          {/* Flujo limpio (después): flechas entre nodos + rama */}
          {view.phase === 'after' && (
            <g>
              {AFTER.slice(0, 4).map(([x], i) => (
                <motion.path
                  key={i}
                  d={`M${x + NODE_W + 2} ${ROW_Y + NODE_H / 2} h${58 - NODE_W - 7} l-3 -3 m3 3 l-3 3`}
                  fill="none"
                  stroke={SCENE.live}
                  strokeWidth={1.25}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={still ? false : { pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.55 + i * 0.08 }}
                />
              ))}
              <motion.path
                d={`M${AFTER[2][0] + NODE_W / 2} ${ROW_Y + NODE_H + 1} v${AFTER[5][1] - ROW_Y - NODE_H - 3} l-3 -3 m3 3 l3 -3`}
                fill="none"
                stroke="rgba(59,130,246,0.9)"
                strokeWidth={1.25}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="2 2"
                initial={still ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.9 }}
              />
            </g>
          )}

          {/* Nodos: viajan del enredo al flujo con spring */}
          {shown.nodes.map((label, i) => {
            const [x, y] = positions[i];
            const isHot = view.hot && i === shown.bottleneck;
            const stroke =
              view.phase === 'after'
                ? i === 5
                  ? 'rgba(59,130,246,0.8)'
                  : SCENE.live
                : isHot
                  ? SCENE.warn
                  : 'rgba(255,255,255,0.3)';
            return (
              <motion.g
                key={label}
                initial={still ? false : { opacity: 0, x: BEFORE[i][0], y: BEFORE[i][1] }}
                animate={{ opacity: view.phase === 'idle' ? 0 : 1, x, y }}
                transition={{
                  x: { ...SPRING, delay: i * 0.07 },
                  y: { ...SPRING, delay: i * 0.07 },
                  opacity: { duration: 0.3, delay: i * 0.06 },
                }}
              >
                <motion.rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={5}
                  fill="#0b1220"
                  animate={{ stroke, opacity: isHot ? [1, 0.55, 1] : 1 }}
                  transition={isHot ? { opacity: { duration: 1, repeat: Infinity }, stroke: { duration: 0.3 } } : { duration: 0.3 }}
                  strokeWidth={isHot ? 1.5 : 1}
                />
                <text
                  x={NODE_W / 2}
                  y={NODE_H / 2 + 2.6}
                  textAnchor="middle"
                  fontSize={6.6}
                  fontWeight={500}
                  fill={isHot ? '#fde68a' : 'rgba(255,255,255,0.85)'}
                >
                  {label}
                </text>
              </motion.g>
            );
          })}

          {/* Etiqueta del problema */}
          {view.hot && (
            <motion.g
              initial={still ? false : { opacity: 0, transform: 'translateY(4px)' }}
              animate={{ opacity: 1, transform: 'translateY(0px)' }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
            >
              {(() => {
                const [cx, cy] = center(BEFORE[shown.bottleneck]);
                const w = shown.tag.length * 3.6 + 12;
                return (
                  <>
                    <rect x={cx - w / 2} y={cy + 12} width={w} height={12} rx={6} fill="rgba(245,158,11,0.16)" stroke="rgba(245,158,11,0.5)" />
                    <text x={cx} y={cy + 20.4} textAnchor="middle" fontSize={6.4} fontWeight={600} fill="#fbbf24">
                      {shown.tag}
                    </text>
                  </>
                );
              })()}
            </motion.g>
          )}

          {/* KPIs */}
          {view.kpiP > 0 && (
            <g>
              {shown.kpis.map((k, i) => {
                const x = 152 + i * 96;
                return (
                  <motion.g
                    key={k.label}
                    initial={still ? false : { opacity: 0, transform: 'translateY(4px)' }}
                    animate={{ opacity: 1, transform: 'translateY(0px)' }}
                    transition={{ duration: 0.28, ease: EASE_OUT, delay: i * 0.08 }}
                  >
                    <rect x={x} y={172} width={88} height={34} rx={6} fill="rgba(255,255,255,0.04)" stroke={SCENE.line} />
                    <text x={x + 8} y={184} fontSize={6.2} fill={SCENE.muted}>
                      {k.label.toUpperCase()}
                    </text>
                    <text x={x + 8} y={199} fontSize={11} fontWeight={700} fill={i === 0 ? SCENE.live : '#fff'}>
                      {k.render(view.kpiP)}
                    </text>
                  </motion.g>
                );
              })}
            </g>
          )}

          {/* Plan: checklist que se va marcando */}
          {view.kpiP >= 1 && (
            <g>
              {['Diagnóstico', 'Plan 90 días', 'Acompañamiento'].map((item, i) => {
                const done = view.ticks > i;
                const y = PLAN_ROWS[i];
                return (
                  <g key={item}>
                    <motion.circle
                      cx={352}
                      cy={y}
                      r={3.6}
                      fill={done ? 'rgba(52,211,153,0.2)' : 'transparent'}
                      stroke={done ? SCENE.ok : 'rgba(255,255,255,0.25)'}
                      strokeWidth={1}
                      animate={{ scale: done ? [1, 1.25, 1] : 1 }}
                      transition={{ duration: 0.3 }}
                      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                    />
                    {done && (
                      <motion.path
                        d={`M${349.6} ${y} l1.8 1.8 l3.2 -3.6`}
                        fill="none"
                        stroke={SCENE.ok}
                        strokeWidth={1.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={still ? false : { pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.25, ease: EASE_OUT }}
                      />
                    )}
                    <text x={361} y={y + 2.6} fontSize={7} fill={done ? '#fff' : SCENE.muted}>
                      {item}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* ---------- PIX ---------- */}
          {/* Globo de diálogo */}
          {view.say && (
            <motion.g
              key={view.say.join('|')}
              initial={still ? false : { opacity: 0, transform: 'translateY(4px) scale(0.96)' }}
              animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
              transition={{ duration: 0.28, ease: EASE_OUT }}
              style={{ transformBox: 'fill-box', transformOrigin: 'bottom left' }}
            >
              <path
                d="M14 16 h108 a8 8 0 0 1 8 8 v30 a8 8 0 0 1 -8 8 h-84 l-8 8 v-8 h-16 a8 8 0 0 1 -8 -8 v-30 a8 8 0 0 1 8 -8 z"
                fill="rgba(255,255,255,0.05)"
                stroke="rgba(255,255,255,0.2)"
              />
              <text x={68} y={35} textAnchor="middle" fontSize={8.5} fontWeight={600} fill="#fff">
                {view.say[0]}
              </text>
              <text x={68} y={48} textAnchor="middle" fontSize={8.5} fontWeight={600} fill={SCENE.live}>
                {view.say[1]}
              </text>
            </motion.g>
          )}

          {/* Cuerpo */}
          <g transform="translate(18 72)">
            {/* Cabeza (asiente con un pequeño bob cuando marca un punto del plan) */}
            <motion.g key={`nod-${view.nod}`} animate={view.nod > 0 && !still ? { y: [0, 2.5, 0, 1.5, 0] } : { y: 0 }} transition={{ duration: 0.55, ease: 'easeInOut' }}>
              <line x1={22} y1={-4} x2={22} y2={0} stroke={SCENE.live} strokeWidth={1.5} />
              <circle cx={22} cy={-6} r={2} fill={SCENE.live} />
              <rect x={0} y={0} width={44} height={40} rx={10} fill="#0b1220" stroke={SCENE.live} strokeWidth={1.5} />
              {/* Ojos: el parpadeo es una CSS animation (.pix-eye en globals.css,
                  scaleY con transform-box: fill-box) — corre fuera del hilo
                  principal y se apaga con prefers-reduced-motion. */}
              {[14, 30].map((cx) => (
                <circle key={cx} cx={cx} cy={17} r={3} fill={SCENE.live} className={still ? undefined : 'pix-eye'} />
              ))}
              <path d="M14 28 Q22 34 30 28" fill="none" stroke={SCENE.live} strokeWidth={1.5} strokeLinecap="round" />
            </motion.g>
            {/* Torso */}
            <rect x={6} y={44} width={32} height={36} rx={9} fill="#0b1220" stroke="rgba(255,255,255,0.35)" strokeWidth={1.25} />
            <rect x={17} y={52} width={10} height={4} rx={2} fill={SCENE.live} opacity={0.7} />
            {/* Piernas */}
            <line x1={15} y1={80} x2={15} y2={94} stroke="rgba(255,255,255,0.35)" strokeWidth={3} strokeLinecap="round" />
            <line x1={29} y1={80} x2={29} y2={94} stroke="rgba(255,255,255,0.35)" strokeWidth={3} strokeLinecap="round" />
            {/* Brazo izquierdo (colgando) */}
            <line x1={6} y1={50} x2={2} y2={74} stroke="rgba(255,255,255,0.5)" strokeWidth={3} strokeLinecap="round" />
          </g>

          {/* Brazo derecho: señala. Se anima el extremo (x2/y2, atributos)
              con spring: el gesto de apuntar se siente vivo e interrumpible. */}
          <motion.line
            x1={SHOULDER[0]}
            y1={SHOULDER[1]}
            initial={still ? false : { x2: hand[0], y2: hand[1] }}
            animate={{ x2: hand[0], y2: hand[1] }}
            transition={SPRING}
            stroke="rgba(255,255,255,0.6)"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <motion.circle
            r={3.6}
            initial={still ? false : { cx: hand[0], cy: hand[1] }}
            animate={{ cx: hand[0], cy: hand[1] }}
            transition={SPRING}
            fill={view.target === 'rest' ? 'rgba(255,255,255,0.6)' : SCENE.live}
          />
        </motion.svg>
      </SceneFrame>
    </div>
  );
}
