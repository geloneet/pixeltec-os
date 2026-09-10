'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { SCENE, SceneFrame } from './scene-frame';
import {
  at,
  typeChars,
  useSceneActive,
  useSceneClock,
  useSceneTimeline,
  type TimelineStep,
} from './use-scene-timeline';

/**
 * WO-2026-00275 · Servicio "Desarrollo Web & Apps".
 *
 * Dirección: "el plano se vuelve producto". Un editor de una sola línea
 * escribe un componente y, al terminar de escribirlo, ese componente se
 * materializa A LA VEZ en una ventana de navegador y en un teléfono: primero
 * el trazo (wireframe que se dibuja con pathLength), luego el relleno. Al
 * final se mide (score) y se despliega. Tres productos rotan — landing,
 * tienda, CRM — para que la construcción nunca se repita igual.
 *
 * Todo es SVG + Framer Motion: nada de imágenes. Solo se animan
 * opacity / pathLength / stroke / fill-opacity.
 */

type RectBlock = {
  kind: 'rect';
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
  tone: 'frame' | 'surface' | 'text' | 'accent' | 'structure';
};
type LineBlock = { kind: 'line'; id: string; x1: number; y1: number; x2: number; y2: number; sw: number };
type Block = RectBlock | LineBlock;

type BuildStep = { code: string; ids: string[] };
type Finale = { cx: number; cy: number; text: (p: number) => string };
type Layout = { name: string; url: string; blocks: Block[]; steps: BuildStep[]; finale: Finale; deploy: string };

type BlockState = 'drawing' | 'filled' | 'ghost';

type State = {
  code: string;
  codeTyping: boolean;
  codeOk: boolean;
  blocks: Record<string, BlockState>;
  finaleOn: boolean;
  finaleP: number; // 0..1
};

const EMPTY: State = { code: '', codeTyping: false, codeOk: false, blocks: {}, finaleOn: false, finaleP: 0 };

// --- Chrome común: navegador (izquierda) y teléfono (derecha) ---------------
const CHROME: Block[] = [
  { kind: 'rect', id: 'web-frame', x: 6, y: 4, w: 268, h: 192, r: 8, tone: 'frame' },
  { kind: 'line', id: 'web-bar', x1: 6, y1: 20, x2: 274, y2: 20, sw: 1 },
  { kind: 'rect', id: 'web-dot1', x: 13, y: 10, w: 4, h: 4, r: 2, tone: 'text' },
  { kind: 'rect', id: 'web-dot2', x: 21, y: 10, w: 4, h: 4, r: 2, tone: 'text' },
  { kind: 'rect', id: 'web-dot3', x: 29, y: 10, w: 4, h: 4, r: 2, tone: 'text' },
  { kind: 'rect', id: 'web-url', x: 44, y: 8, w: 120, h: 8, r: 4, tone: 'surface' },
  { kind: 'rect', id: 'app-frame', x: 296, y: 2, w: 110, h: 196, r: 14, tone: 'frame' },
  { kind: 'rect', id: 'app-notch', x: 334, y: 8, w: 34, h: 4, r: 2, tone: 'text' },
];
const CHROME_IDS = CHROME.map((b) => b.id);

const R = (id: string, x: number, y: number, w: number, h: number, tone: RectBlock['tone'], r = 3): RectBlock => ({
  kind: 'rect',
  id,
  x,
  y,
  w,
  h,
  r,
  tone,
});
const L = (id: string, x1: number, y1: number, x2: number, y2: number, sw: number): LineBlock => ({
  kind: 'line',
  id,
  x1,
  y1,
  x2,
  y2,
  sw,
});

const LAYOUTS: Layout[] = [
  {
    name: 'landing',
    url: 'pixeltec.mx',
    blocks: [
      ...CHROME,
      R('nav', 14, 28, 252, 12, 'surface'),
      R('nav-logo', 18, 31, 20, 6, 'accent', 2),
      R('nav-links', 200, 31, 62, 6, 'text', 2),
      R('hero-title', 14, 50, 132, 12, 'text'),
      R('hero-sub', 14, 66, 104, 8, 'text', 2),
      R('hero-cta', 14, 82, 46, 12, 'accent', 6),
      R('hero-visual', 160, 48, 106, 52, 'surface', 6),
      R('card1', 14, 112, 78, 44, 'surface', 6),
      R('card2', 101, 112, 78, 44, 'surface', 6),
      R('card3', 188, 112, 78, 44, 'surface', 6),
      R('cta-band', 14, 166, 252, 18, 'structure', 6),
      R('status', 304, 14, 94, 4, 'text', 2),
      R('app-header', 304, 24, 94, 14, 'surface', 4),
      R('app-hero', 304, 44, 94, 46, 'structure', 6),
      R('row1', 304, 96, 94, 16, 'surface', 4),
      R('row2', 304, 116, 94, 16, 'surface', 4),
      R('row3', 304, 136, 94, 16, 'surface', 4),
      R('tabbar', 304, 174, 94, 16, 'surface', 5),
      R('tab1', 314, 180, 5, 5, 'accent', 2.5),
      R('tab2', 336, 180, 5, 5, 'text', 2.5),
      R('tab3', 358, 180, 5, 5, 'text', 2.5),
      R('tab4', 380, 180, 5, 5, 'text', 2.5),
    ],
    steps: [
      { code: 'scaffold  web/page.tsx · app/Home.tsx', ids: CHROME_IDS },
      { code: '<Nav logo links={3} />  ·  <StatusBar />', ids: ['nav', 'nav-logo', 'nav-links', 'status'] },
      { code: '<Hero title cta />  ·  <AppHeader />', ids: ['hero-title', 'hero-sub', 'hero-cta', 'app-header'] },
      { code: '<Media aspect="16/9" />  ·  <HeroCard />', ids: ['hero-visual', 'app-hero'] },
      { code: '<Grid cols={3} />  ·  <List rows={3} />', ids: ['card1', 'card2', 'card3', 'row1', 'row2', 'row3'] },
      { code: '<CTA band />  ·  <TabBar items={4} />', ids: ['cta-band', 'tabbar', 'tab1', 'tab2', 'tab3', 'tab4'] },
    ],
    finale: { cx: 213, cy: 74, text: (p) => `${Math.round(p * 100)}` },
    deploy: '✓ deploy · pixeltec.mx · lighthouse 100 · 1.2 s',
  },
  {
    name: 'tienda',
    url: 'tienda.mx',
    blocks: [
      ...CHROME,
      R('nav', 14, 28, 252, 12, 'surface'),
      R('search', 100, 30, 80, 8, 'text', 4),
      R('banner', 14, 48, 252, 36, 'structure', 6),
      R('p1', 14, 92, 57, 40, 'surface', 5),
      R('p2', 79, 92, 57, 40, 'surface', 5),
      R('p3', 144, 92, 57, 40, 'surface', 5),
      R('p4', 209, 92, 57, 40, 'surface', 5),
      R('p5', 14, 140, 57, 40, 'surface', 5),
      R('p6', 79, 140, 57, 40, 'surface', 5),
      R('p7', 144, 140, 57, 40, 'surface', 5),
      R('p8', 209, 140, 57, 40, 'surface', 5),
      R('status', 304, 14, 94, 4, 'text', 2),
      R('app-search', 304, 24, 94, 12, 'surface', 6),
      R('chips', 304, 42, 94, 10, 'text', 5),
      R('a1', 304, 58, 44, 44, 'surface', 5),
      R('a2', 354, 58, 44, 44, 'surface', 5),
      R('a3', 304, 108, 44, 44, 'surface', 5),
      R('a4', 354, 108, 44, 44, 'surface', 5),
      R('fab', 380, 156, 14, 14, 'accent', 7),
      R('tabbar', 304, 174, 94, 16, 'surface', 5),
    ],
    steps: [
      { code: 'scaffold  web/tienda.tsx · app/Shop.tsx', ids: CHROME_IDS },
      { code: '<Nav search />  ·  <SearchBar />', ids: ['nav', 'search', 'status', 'app-search'] },
      { code: '<Banner promo />  ·  <Chips categorias />', ids: ['banner', 'chips'] },
      { code: '<Products cols={4} />  ·  <Products cols={2} />', ids: ['p1', 'p2', 'p3', 'p4', 'a1', 'a2'] },
      { code: '<Products row={2} />  ·  <CartFab />', ids: ['p5', 'p6', 'p7', 'p8', 'a3', 'a4', 'fab'] },
      { code: '<Checkout stripe />  ·  <TabBar />', ids: ['tabbar'] },
    ],
    finale: { cx: 140, cy: 66, text: (p) => (p >= 1 ? '✓' : `${Math.round(p * 42)} ms`) },
    deploy: '✓ deploy · stripe webhook ok · 42 ms',
  },
  {
    name: 'crm',
    url: 'app.crm.mx',
    blocks: [
      ...CHROME,
      R('sidebar', 14, 28, 44, 156, 'surface', 6),
      R('topbar', 66, 28, 200, 12, 'surface'),
      R('kpi1', 66, 48, 62, 26, 'surface', 5),
      R('kpi2', 135, 48, 62, 26, 'surface', 5),
      R('kpi3', 204, 48, 62, 26, 'surface', 5),
      R('chart', 66, 82, 130, 72, 'surface', 6),
      L('b1', 80, 146, 80, 122, 8),
      L('b2', 100, 146, 100, 108, 8),
      L('b3', 120, 146, 120, 128, 8),
      L('b4', 140, 146, 140, 100, 8),
      L('b5', 160, 146, 160, 112, 8),
      L('b6', 180, 146, 180, 92, 8),
      R('table', 204, 82, 62, 72, 'surface', 6),
      R('status', 304, 14, 94, 4, 'text', 2),
      R('app-header', 304, 24, 94, 14, 'surface', 4),
      R('akpi1', 304, 44, 44, 28, 'surface', 5),
      R('akpi2', 354, 44, 44, 28, 'surface', 5),
      R('achart', 304, 78, 94, 50, 'surface', 6),
      L('ab1', 316, 120, 316, 104, 6),
      L('ab2', 332, 120, 332, 94, 6),
      L('ab3', 348, 120, 348, 110, 6),
      L('ab4', 364, 120, 364, 88, 6),
      L('ab5', 380, 120, 380, 98, 6),
      R('row1', 304, 134, 94, 14, 'surface', 4),
      R('row2', 304, 152, 94, 14, 'surface', 4),
      R('tabbar', 304, 174, 94, 16, 'surface', 5),
    ],
    steps: [
      { code: 'scaffold  web/dashboard.tsx · app/Today.tsx', ids: CHROME_IDS },
      { code: '<Sidebar />  ·  <StatusBar />', ids: ['sidebar', 'status'] },
      { code: '<Topbar user />  ·  <AppHeader />', ids: ['topbar', 'app-header'] },
      { code: '<KPI x3 />  ·  <KPI x2 />', ids: ['kpi1', 'kpi2', 'kpi3', 'akpi1', 'akpi2'] },
      { code: '<Chart series="ventas" />  ·  <Chart />', ids: ['chart', 'achart', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'ab1', 'ab2', 'ab3', 'ab4', 'ab5'] },
      { code: '<Table rows={4} />  ·  <List /> <TabBar />', ids: ['table', 'row1', 'row2', 'tabbar'] },
    ],
    finale: { cx: 235, cy: 118, text: (p) => `${Math.round(p * 12)} ms` },
    deploy: '✓ deploy · postgres + drizzle · 12 ms',
  },
];

type Setter = (update: (prev: State) => State) => void;

function buildSteps(layout: Layout, set: Setter): TimelineStep[] {
  const steps: TimelineStep[] = [];
  const setBlocks = (ids: string[], st: BlockState) =>
    set((s) => {
      const blocks = { ...s.blocks };
      ids.forEach((id) => (blocks[id] = st));
      return { ...s, blocks };
    });

  layout.steps.forEach((bs, i) => {
    steps.push(at(i === 0 ? 300 : 420, () => set((s) => ({ ...s, code: '', codeTyping: true, codeOk: false }))));
    steps.push(
      ...typeChars(bs.code, 20, (partial, done) => set((s) => ({ ...s, code: partial, codeTyping: !done })), 80),
    );
    steps.push(at(160, () => setBlocks(bs.ids, 'drawing')));
    steps.push(at(440, () => setBlocks(bs.ids, 'filled')));
  });

  // Medición: anillo + contador.
  steps.push(at(420, () => set((s) => ({ ...s, code: '', codeTyping: true }))));
  steps.push(...typeChars('measure  lighthouse · vitals · api', 20, (partial, done) => set((s) => ({ ...s, code: partial, codeTyping: !done })), 60));
  steps.push(at(120, () => set((s) => ({ ...s, finaleOn: true }))));
  for (let k = 1; k <= 10; k++) {
    steps.push(at(70, () => set((s) => ({ ...s, finaleP: k / 10 }))));
  }
  steps.push(at(360, () => set((s) => ({ ...s, code: layout.deploy, codeTyping: false, codeOk: true }))));
  return steps;
}

function posterState(): State {
  let s: State = EMPTY;
  const set: Setter = (u) => {
    s = u(s);
  };
  buildSteps(LAYOUTS[0], set).forEach((step) => step.run());
  return s;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const FILL: Record<RectBlock['tone'], string> = {
  frame: 'transparent',
  surface: 'rgba(255,255,255,0.07)',
  text: 'rgba(255,255,255,0.26)',
  accent: 'rgba(34,211,238,0.55)',
  structure: 'rgba(59,130,246,0.32)',
};

export function SiteAppBuildBg({ poster = false }: { poster?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { active, still } = useSceneActive(ref, poster);
  const clock = useSceneClock(active, still);

  const [layoutIndex, setLayoutIndex] = useState(0);
  const [runKey, setRunKey] = useState(0);
  const [state, setState] = useState<State>(EMPTY);
  const [phaseOut, setPhaseOut] = useState(false);

  const layout = LAYOUTS[layoutIndex];
  const steps = useMemo(() => {
    if (still) return null;
    const list = buildSteps(layout, setState);
    // Se contempla el resultado; luego el producto vuelve a plano (ghost) y se limpia.
    list.push(
      at(2800, () => {
        setPhaseOut(true);
        setState((s) => {
          const blocks = { ...s.blocks };
          Object.keys(blocks).forEach((id) => (blocks[id] = 'ghost'));
          return { ...s, blocks, finaleOn: false, code: '', codeOk: false };
        });
      }),
    );
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, still, runKey]);

  const onEnd = useCallback(() => {
    window.setTimeout(() => {
      setState(EMPTY);
      setPhaseOut(false);
      setLayoutIndex((i) => (i + 1) % LAYOUTS.length);
      setRunKey((k) => k + 1);
    }, 700);
  }, []);

  useSceneTimeline(steps, active, runKey, onEnd);

  const poster0 = useMemo(() => (still ? posterState() : null), [still]);
  const view = poster0 ?? state;
  const shown = still ? LAYOUTS[0] : layout;

  return (
    <div ref={ref} className="absolute inset-0">
      <SceneFrame
        system="PixelTEC Build"
        clock={clock}
        still={still}
        label="Simulación de la construcción en tiempo real de un sitio web y una app móvil: cada componente que se escribe en el editor se dibuja como wireframe y se materializa a la vez en un navegador y en un teléfono; al final se mide y se despliega."
      >
        <div className="flex h-[224px] flex-col gap-1.5">
          {/* Editor de una línea */}
          <div
            className="flex h-[18px] items-center gap-1.5 rounded-md border px-2 font-mono text-[8.5px]"
            style={{ borderColor: SCENE.line, backgroundColor: 'rgba(0,0,0,0.42)' }}
          >
            <span style={{ color: view.codeOk ? SCENE.ok : SCENE.live }}>{view.codeOk ? '' : '›'}</span>
            <span className="truncate" style={{ color: view.codeOk ? SCENE.ok : 'rgba(255,255,255,0.85)' }}>
              {view.code}
            </span>
            {view.codeTyping && (
              <motion.span
                className="inline-block h-[10px] w-[2px] rounded-sm"
                style={{ backgroundColor: SCENE.live }}
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              />
            )}
            <span className="ml-auto shrink-0 uppercase tracking-[0.14em]" style={{ color: SCENE.muted }}>
              {shown.name} · {still ? 1 : layoutIndex + 1}/{LAYOUTS.length}
            </span>
          </div>

          {/* Navegador + teléfono */}
          <motion.svg
            viewBox="0 0 460 200"
            className="w-full flex-1"
            preserveAspectRatio="xMidYMin meet"
            animate={{ opacity: phaseOut ? 0.55 : 1 }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
          >
            {shown.blocks.map((b) => (
              <BlockShape key={b.id} block={b} state={view.blocks[b.id]} still={still} />
            ))}

            {/* URL del navegador */}
            {view.blocks['web-url'] === 'filled' && (
              <text x={52} y={14.5} fontSize={6} fontFamily="ui-monospace, monospace" fill={SCENE.muted}>
                https://{shown.url}
              </text>
            )}

            {/* Medición: anillo que se dibuja + valor */}
            {view.finaleOn && (
              <g>
                <motion.circle
                  cx={shown.finale.cx}
                  cy={shown.finale.cy}
                  r={15}
                  fill="rgba(6,8,13,0.85)"
                  stroke={SCENE.ok}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${shown.finale.cx} ${shown.finale.cy})`}
                  initial={still ? false : { pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: view.finaleP, opacity: 1 }}
                  transition={{ duration: 0.12, ease: 'linear' }}
                />
                <text
                  x={shown.finale.cx}
                  y={shown.finale.cy + 3.2}
                  textAnchor="middle"
                  fontSize={8.5}
                  fontWeight={700}
                  fill="#fff"
                >
                  {shown.finale.text(view.finaleP)}
                </text>
              </g>
            )}
          </motion.svg>
        </div>
      </SceneFrame>
    </div>
  );
}

function BlockShape({ block, state, still }: { block: Block; state: BlockState | undefined; still: boolean }) {
  // Sin estado = todavía no existe. Se mantiene en el DOM con opacity 0 para
  // que la transición hidden→drawing sea continua (sin remontar).
  const variants = {
    hidden: { opacity: 0, pathLength: 0, fillOpacity: 0, stroke: SCENE.live },
    drawing: { opacity: 1, pathLength: 1, fillOpacity: 0, stroke: SCENE.live },
    filled: {
      opacity: 1,
      pathLength: 1,
      fillOpacity: 1,
      stroke: block.kind === 'line' ? SCENE.live : block.tone === 'frame' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.10)',
    },
    ghost: { opacity: 0.45, pathLength: 1, fillOpacity: 0, stroke: 'rgba(255,255,255,0.16)' },
  };
  const key = state ?? 'hidden';
  const common = {
    variants,
    initial: still ? false : ('hidden' as const),
    animate: key,
    transition:
      key === 'drawing'
        ? { pathLength: { duration: 0.38, ease: EASE_OUT }, opacity: { duration: 0.12 } }
        : { duration: 0.26, ease: EASE_OUT },
  };

  if (block.kind === 'line') {
    return (
      <motion.line
        {...common}
        x1={block.x1}
        y1={block.y1}
        x2={block.x2}
        y2={block.y2}
        strokeWidth={block.sw}
        strokeLinecap="round"
        style={{ stroke: SCENE.live }}
      />
    );
  }

  return (
    <motion.rect
      {...common}
      x={block.x}
      y={block.y}
      width={block.w}
      height={block.h}
      rx={block.r ?? 3}
      strokeWidth={block.tone === 'frame' ? 1.25 : 1}
      fill={FILL[block.tone]}
    />
  );
}
