'use client';

import { useCallback, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { DEVICE, EASE_OUT, SCENE, SPRING, SPRING_SETTLE, SceneFrame, type SceneProps } from './scene-frame';
import { at, useSceneActive, useSceneTimeline, type TimelineStep } from './use-scene-timeline';

/**
 * WO-2026-00275 · Servicio "Desarrollo Web & Apps" · ronda 2.
 *
 * Antes (ronda 1): un editor de una línea tipeaba `<Hero title cta />` y unos
 * rectángulos-wireframe se dibujaban y rellenaban en un navegador y un
 * teléfono; cerraba con score Lighthouse y `✓ deploy`.
 * Ahora: el protagonista es el PRODUCTO TERMINADO. Un sitio y su app —con
 * texto, color, botones y datos reales— se ensamblan pieza a pieza con
 * springs escalonados (la "construcción" queda como un gesto de 1.4 s, al
 * estilo de un reveal de keynote), descansan terminados y reciben un barrido
 * de luz; después se disuelven y entra el siguiente producto. Sin código
 * expuesto, sin chrome de terminal, sin métricas técnicas: lo que ve el
 * cliente es lo que recibiría.
 *
 * Tres productos rotan: hotel boutique (landing + app de huésped), tienda de
 * café (e-commerce + app) y CRM (panel de ventas + app).
 */

type Ctx = { rev: number; still: boolean };
type Product = { name: string; domain: string; appTitle: string; pieces: number; web: (c: Ctx) => ReactNode; app: (c: Ctx) => ReactNode };

type State = { rev: number; sweep: boolean };
const EMPTY: State = { rev: 0, sweep: false };

// --- Paletas de contenido (imágenes hechas con gradientes; sin morados: ADR-0014) ---
const OCEAN = 'linear-gradient(135deg, #0c4a6e 0%, #0e7490 48%, #22d3ee 100%)';
const COFFEE = 'linear-gradient(135deg, #3f1d0b 0%, #92400e 60%, #d97706 100%)';
const THUMBS = [
  'linear-gradient(145deg, #7c2d12, #ea580c)',
  'linear-gradient(145deg, #14532d, #22c55e)',
  'linear-gradient(145deg, #1e3a8a, #3b82f6)',
  'linear-gradient(145deg, #0f766e, #2dd4bf)',
];
const BAR = 'linear-gradient(180deg, #67e8f9 0%, #22d3ee 40%, #2563eb 100%)';

const surface: CSSProperties = { background: 'rgba(255,255,255,0.06)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' };

/** Pieza del producto: aparece cuando su índice ya fue "construido". */
function Piece({ i, ctx, className, style, children }: { i: number; ctx: Ctx; className?: string; style?: CSSProperties; children?: ReactNode }) {
  const on = ctx.still || i < ctx.rev;
  return (
    <motion.div
      className={className}
      style={style}
      initial={ctx.still ? false : { opacity: 0, y: 10, scale: 0.97 }}
      animate={on ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 10, scale: 0.97 }}
      transition={SPRING_SETTLE}
    >
      {children}
    </motion.div>
  );
}

const Brand = ({ name }: { name: string }) => (
  <span className="flex items-center gap-1">
    <span className="h-[6px] w-[6px] rounded-[2px]" style={{ background: 'linear-gradient(135deg,#67e8f9,#2563eb)' }} />
    <span className="text-[6.5px] font-semibold" style={{ color: SCENE.text }}>
      {name}
    </span>
  </span>
);

const Row = ({ label, sub, tone }: { label: string; sub: string; tone: string }) => (
  <div className="flex items-center gap-1.5 rounded-[7px] px-1.5 py-1" style={surface}>
    <span className="h-[10px] w-[10px] shrink-0 rounded-full" style={{ background: tone }} />
    <span className="min-w-0 leading-none">
      <span className="block truncate text-[6px] font-medium" style={{ color: SCENE.text }}>
        {label}
      </span>
      <span className="mt-[2px] block truncate text-[5px]" style={{ color: SCENE.muted }}>
        {sub}
      </span>
    </span>
  </div>
);

const TabBar = ({ i, ctx }: { i: number; ctx: Ctx }) => (
  <Piece i={i} ctx={ctx} className="mt-auto flex items-center justify-around rounded-[8px] px-2 py-[5px]" style={surface}>
    {[0, 1, 2, 3].map((k) => (
      <span key={k} className="h-[5px] w-[5px] rounded-full" style={{ background: k === 0 ? SCENE.brand : 'rgba(255,255,255,0.28)' }} />
    ))}
  </Piece>
);

const Kpi = ({ label, value, delta, big }: { label: string; value: string; delta: string; big?: boolean }) => (
  <div className="min-w-0 flex-1 rounded-[7px] px-1.5 py-1.5" style={surface}>
    <p className="truncate text-[5px]" style={{ color: SCENE.muted }}>
      {label}
    </p>
    <p className={`${big ? 'text-[9px]' : 'text-[7.5px]'} mt-[2px] font-semibold leading-none tabular-nums`} style={{ color: SCENE.text }}>
      {value}
    </p>
    <p className="mt-[2px] text-[5px] font-medium leading-none" style={{ color: SCENE.ok }}>
      {delta}
    </p>
  </div>
);

const Bars = ({ values, ctx, on, h }: { values: number[]; ctx: Ctx; on: boolean; h: number }) => (
  <div className="flex items-end gap-[3px]" style={{ height: h }}>
    {values.map((v, k) => (
      <motion.span
        key={k}
        className="flex-1 rounded-[2px]"
        style={{ height: `${v}%`, background: BAR, opacity: k === values.length - 1 ? 1 : 0.55, transformOrigin: 'bottom' }}
        initial={ctx.still ? false : { scaleY: 0 }}
        animate={{ scaleY: on ? 1 : 0 }}
        transition={{ ...SPRING, delay: on ? k * 0.05 : 0 }}
      />
    ))}
  </div>
);

const PRODUCTS: Product[] = [
  {
    name: 'Casa Mar',
    domain: 'casamar.mx',
    appTitle: 'Mi estancia',
    pieces: 12,
    web: (c) => (
      <div className="flex h-full flex-col gap-1.5">
        <Piece i={0} ctx={c} className="flex items-center justify-between px-0.5">
          <Brand name="Casa Mar" />
          <span className="flex gap-2 text-[5px]" style={{ color: SCENE.text2 }}>
            <span>Suites</span>
            <span>Restaurante</span>
            <span>Reservar</span>
          </span>
        </Piece>
        <Piece i={2} ctx={c} className="relative h-[66px] overflow-hidden rounded-[10px] p-2.5" style={{ background: OCEAN, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)' }}>
          <p className="text-[4.5px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'rgba(255,255,255,0.75)' }}>
            Puerto Vallarta
          </p>
          <p className="mt-1 max-w-[62%] text-[10px] font-semibold leading-[1.05] tracking-[-0.01em] text-white">Despierta frente al mar</p>
          <span className="mt-2 inline-block rounded-full bg-white px-2 py-[3px] text-[5.5px] font-semibold text-[#0c4a6e]">Reservar</span>
          <span className="absolute -right-4 -top-6 h-16 w-16 rounded-full" style={{ background: 'rgba(255,255,255,0.14)', filter: 'blur(8px)' }} />
        </Piece>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            ['Suites', 'Vista al mar', 4],
            ['Restaurante', 'Cocina local', 5],
            ['Spa', 'Rituales', 6],
          ].map(([t, s, i]) => (
            <Piece key={t as string} i={i as number} ctx={c} className="rounded-[8px] px-1.5 py-1.5" style={surface}>
              <span className="block h-[7px] w-[7px] rounded-[2px]" style={{ background: OCEAN }} />
              <p className="mt-1 text-[6px] font-medium leading-none" style={{ color: SCENE.text }}>
                {t}
              </p>
              <p className="mt-[2px] text-[5px] leading-none" style={{ color: SCENE.muted }}>
                {s}
              </p>
            </Piece>
          ))}
        </div>
        <Piece i={10} ctx={c} className="mt-auto flex items-center justify-between rounded-[7px] px-2 py-[5px]" style={surface}>
          <span className="text-[5.5px]" style={{ color: SCENE.text2 }}>
            Reserva directa · mejor precio garantizado
          </span>
          <span className="text-[5.5px] font-semibold" style={{ color: SCENE.brand }}>
            Ver fechas
          </span>
        </Piece>
      </div>
    ),
    app: (c) => (
      <div className="flex h-full flex-col gap-1.5">
        <Piece i={1} ctx={c} className="px-0.5">
          <p className="text-[7px] font-semibold leading-none" style={{ color: SCENE.text }}>
            Mi estancia
          </p>
          <p className="mt-[3px] text-[5px] leading-none" style={{ color: SCENE.muted }}>
            12 – 15 octubre
          </p>
        </Piece>
        <Piece i={3} ctx={c} className="relative h-[56px] overflow-hidden rounded-[10px] p-2" style={{ background: OCEAN, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)' }}>
          <p className="text-[6.5px] font-semibold leading-tight text-white">Suite Vista Mar</p>
          <p className="mt-[2px] text-[5px]" style={{ color: 'rgba(255,255,255,0.8)' }}>
            Piso 3 · 2 huéspedes
          </p>
          <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-1.5 py-[2px] text-[4.5px] font-semibold text-[#0c4a6e]">Llave digital</span>
        </Piece>
        <Piece i={7} ctx={c}>
          <Row label="Check-in" sub="Hoy · 15:00" tone={OCEAN} />
        </Piece>
        <Piece i={8} ctx={c}>
          <Row label="Desayuno" sub="7:00 – 11:00" tone="linear-gradient(135deg,#fde68a,#f59e0b)" />
        </Piece>
        <Piece i={9} ctx={c}>
          <Row label="Spa" sub="Reservar masaje" tone="linear-gradient(135deg,#a7f3d0,#34d399)" />
        </Piece>
        <TabBar i={11} ctx={c} />
      </div>
    ),
  },
  {
    name: 'Altura',
    domain: 'altura.cafe',
    appTitle: 'Altura',
    pieces: 12,
    web: (c) => (
      <div className="flex h-full flex-col gap-1.5">
        <Piece i={0} ctx={c} className="flex items-center gap-2 px-0.5">
          <Brand name="Altura" />
          <span className="flex-1 rounded-full px-2 py-[3px] text-[5px]" style={{ ...surface, color: SCENE.muted }}>
            Buscar café…
          </span>
          <span className="h-[7px] w-[7px] rounded-full" style={{ background: 'rgba(255,255,255,0.25)' }} />
        </Piece>
        <Piece i={2} ctx={c} className="flex items-center justify-between rounded-[8px] px-2 py-[5px]" style={{ background: COFFEE, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)' }}>
          <span className="text-[6px] font-semibold text-white">Cosecha 2026 · tueste fresco</span>
          <span className="text-[5px] font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>
            Envío gratis desde $499
          </span>
        </Piece>
        <div className="grid grid-cols-4 gap-1.5">
          {[
            ['Chiapas', '$249', 4],
            ['Veracruz', '$229', 5],
            ['Nayarit', '$269', 6],
            ['Oaxaca', '$289', 7],
          ].map(([t, p, i], k) => (
            <Piece key={t as string} i={i as number} ctx={c} className="rounded-[8px] p-1" style={surface}>
              <span className="block h-[30px] rounded-[6px]" style={{ background: THUMBS[k], boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)' }} />
              <p className="mt-1 truncate text-[5.5px] font-medium leading-none" style={{ color: SCENE.text }}>
                {t}
              </p>
              <p className="mt-[2px] text-[6px] font-semibold leading-none tabular-nums" style={{ color: SCENE.text }}>
                {p}
              </p>
            </Piece>
          ))}
        </div>
        <Piece i={10} ctx={c} className="mt-auto flex items-center justify-between rounded-[7px] px-2 py-[5px]" style={surface}>
          <span className="text-[5.5px]" style={{ color: SCENE.text2 }}>
            Suscripción mensual · 15 % de descuento
          </span>
          <span className="rounded-full px-1.5 py-[2px] text-[5px] font-semibold text-[#06080d]" style={{ background: SCENE.brand }}>
            Empezar
          </span>
        </Piece>
      </div>
    ),
    app: (c) => (
      <div className="relative flex h-full flex-col gap-1.5">
        <Piece i={1} ctx={c} className="rounded-full px-2 py-[4px] text-[5px]" style={{ ...surface, color: SCENE.muted }}>
          Buscar café…
        </Piece>
        <Piece i={3} ctx={c} className="flex gap-1">
          {['Espresso', 'Filtro', 'Molido'].map((ch, k) => (
            <span key={ch} className="rounded-full px-1.5 py-[2px] text-[4.5px] font-medium" style={k === 0 ? { background: SCENE.brand, color: '#06080d' } : { ...surface, color: SCENE.text2 }}>
              {ch}
            </span>
          ))}
        </Piece>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            ['Chiapas', '$249', 6],
            ['Veracruz', '$229', 7],
            ['Nayarit', '$269', 8],
            ['Oaxaca', '$289', 9],
          ].map(([t, p, i], k) => (
            <Piece key={t as string} i={i as number} ctx={c} className="rounded-[8px] p-1" style={surface}>
              <span className="block h-[22px] rounded-[6px]" style={{ background: THUMBS[k] }} />
              <p className="mt-1 truncate text-[5px] font-medium leading-none" style={{ color: SCENE.text }}>
                {t}
              </p>
              <p className="mt-[2px] text-[5.5px] font-semibold leading-none tabular-nums" style={{ color: SCENE.text }}>
                {p}
              </p>
            </Piece>
          ))}
        </div>
        <Piece i={10} ctx={c} className="absolute bottom-6 right-1 flex h-[16px] w-[16px] items-center justify-center rounded-full" style={{ background: 'linear-gradient(145deg,#67e8f9,#2563eb)', boxShadow: '0 4px 10px rgba(34,211,238,0.35)' }}>
          <svg viewBox="0 0 12 12" className="h-[8px] w-[8px]" aria-hidden="true">
            <path d="M3 4.5h6l-.6 5H3.6z M4.5 4.5V3.5a1.5 1.5 0 0 1 3 0v1" fill="none" stroke="#06080d" strokeWidth={1} strokeLinejoin="round" />
          </svg>
        </Piece>
        <TabBar i={11} ctx={c} />
      </div>
    ),
  },
  {
    name: 'Panel de ventas',
    domain: 'app.ventas.mx',
    appTitle: 'Hoy',
    pieces: 12,
    web: (c) => (
      <div className="flex h-full gap-1.5">
        <Piece i={0} ctx={c} className="flex w-[26px] shrink-0 flex-col items-center gap-2 rounded-[8px] py-2" style={surface}>
          <span className="h-[7px] w-[7px] rounded-[2px]" style={{ background: 'linear-gradient(135deg,#67e8f9,#2563eb)' }} />
          {[0, 1, 2, 3].map((k) => (
            <span key={k} className="h-[4px] w-[10px] rounded-full" style={{ background: k === 0 ? SCENE.brand : 'rgba(255,255,255,0.22)' }} />
          ))}
        </Piece>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Piece i={2} ctx={c} className="flex items-center justify-between px-0.5">
            <span className="text-[6.5px] font-semibold" style={{ color: SCENE.text }}>
              Ventas · Septiembre
            </span>
            <span className="h-[8px] w-[8px] rounded-full" style={{ background: 'linear-gradient(135deg,#fde68a,#f59e0b)' }} />
          </Piece>
          <div className="flex gap-1.5">
            <Piece i={4} ctx={c} className="flex min-w-0 flex-1">
              <Kpi label="Ingresos" value="$1.24M" delta="+18 %" />
            </Piece>
            <Piece i={5} ctx={c} className="flex min-w-0 flex-1">
              <Kpi label="Leads" value="312" delta="+9 %" />
            </Piece>
            <Piece i={6} ctx={c} className="flex min-w-0 flex-1">
              <Kpi label="Cierre" value="27 %" delta="+4 pts" />
            </Piece>
          </div>
          <div className="flex flex-1 gap-1.5">
            <Piece i={7} ctx={c} className="flex flex-[1.5] flex-col rounded-[8px] px-2 pb-1.5 pt-1.5" style={surface}>
              <p className="text-[5px]" style={{ color: SCENE.muted }}>
                Ingresos por semana
              </p>
              <div className="mt-auto">
                <Bars values={[38, 52, 46, 68, 60, 82, 96]} ctx={c} on={c.still || 7 < c.rev} h={46} />
              </div>
            </Piece>
            <Piece i={8} ctx={c} className="flex flex-1 flex-col gap-1 rounded-[8px] p-1.5" style={surface}>
              {[
                ['Marina R.', '$48k'],
                ['Grupo Norte', '$32k'],
                ['Hotel Sol', '$27k'],
              ].map(([n, v], k) => (
                <div key={n} className="flex items-center gap-1">
                  <span className="h-[6px] w-[6px] rounded-full" style={{ background: THUMBS[k] }} />
                  <span className="min-w-0 flex-1 truncate text-[5px]" style={{ color: SCENE.text2 }}>
                    {n}
                  </span>
                  <span className="text-[5px] font-semibold tabular-nums" style={{ color: SCENE.text }}>
                    {v}
                  </span>
                </div>
              ))}
            </Piece>
          </div>
        </div>
      </div>
    ),
    app: (c) => (
      <div className="flex h-full flex-col gap-1.5">
        <Piece i={1} ctx={c} className="px-0.5">
          <p className="text-[7px] font-semibold leading-none" style={{ color: SCENE.text }}>
            Hoy
          </p>
          <p className="mt-[3px] text-[5px] leading-none" style={{ color: SCENE.muted }}>
            Miércoles 10 · Sep
          </p>
        </Piece>
        <Piece i={3} ctx={c} className="flex gap-1.5">
          <Kpi label="Ventas" value="$41k" delta="+12 %" big />
          <Kpi label="Leads" value="18" delta="+3" big />
        </Piece>
        <Piece i={9} ctx={c} className="rounded-[8px] px-1.5 pb-1.5 pt-1.5" style={surface}>
          <p className="text-[5px]" style={{ color: SCENE.muted }}>
            Semana
          </p>
          <div className="mt-1">
            <Bars values={[45, 62, 55, 78, 92]} ctx={c} on={c.still || 9 < c.rev} h={26} />
          </div>
        </Piece>
        <Piece i={10} ctx={c}>
          <Row label="Marina R." sub="Propuesta enviada" tone={THUMBS[0]} />
        </Piece>
        <TabBar i={11} ctx={c} />
      </div>
    ),
  },
];

type Setter = (update: (prev: State) => State) => void;

function buildSteps(product: Product, set: Setter): TimelineStep[] {
  const steps: TimelineStep[] = [];
  for (let k = 1; k <= product.pieces; k++) {
    steps.push(at(k === 1 ? 350 : 115, () => set((s) => ({ ...s, rev: k }))));
  }
  // Producto terminado: barrido de luz (una vez) y contemplación.
  steps.push(at(650, () => set((s) => ({ ...s, sweep: true }))));
  return steps;
}

export function SiteAppBuildBg({ poster = false, layout, stageClassName }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { active, still } = useSceneActive(ref, poster);

  const [productIndex, setProductIndex] = useState(0);
  const [runKey, setRunKey] = useState(0);
  const [state, setState] = useState<State>(EMPTY);
  const [fading, setFading] = useState(false);

  const product = PRODUCTS[productIndex];
  const steps = useMemo(() => {
    if (still) return null;
    const list = buildSteps(product, setState);
    list.push(at(4600, () => setFading(true)));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, still, runKey]);

  const onEnd = useCallback(() => {
    window.setTimeout(() => {
      setState(EMPTY);
      setFading(false);
      setProductIndex((i) => (i + 1) % PRODUCTS.length);
      setRunKey((k) => k + 1);
    }, 560);
  }, []);

  useSceneTimeline(steps, active, runKey, onEnd);

  const shown = still ? PRODUCTS[0] : product;
  const ctx: Ctx = { rev: still ? shown.pieces : state.rev, still };
  const sweep = !still && state.sweep;

  return (
    <div ref={ref} className="absolute inset-0">
      <SceneFrame layout={layout} stageClassName={stageClassName} label="Simulación con datos ficticios de un sitio web y su app móvil terminados —hotel boutique, tienda de café, panel de ventas— que se ensamblan pieza a pieza en un navegador y en un teléfono.">
        <motion.div
          className="relative flex h-[232px] gap-3"
          animate={{ opacity: fading ? 0 : 1 }}
          transition={{ duration: 0.55, ease: EASE_OUT }}
        >
          {/* Navegador */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[14px]" style={DEVICE}>
            <div className="flex items-center gap-1.5 px-2.5 pb-1.5 pt-2">
              {[0, 1, 2].map((k) => (
                <span key={k} className="h-[5px] w-[5px] rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
              ))}
              <span className="ml-2 flex-1 truncate rounded-full px-2 py-[3px] text-center text-[6px]" style={{ background: 'rgba(255,255,255,0.05)', color: SCENE.muted }}>
                {shown.domain}
              </span>
            </div>
            <div className="min-h-0 flex-1 px-2.5 pb-2.5 pt-1">{shown.web(ctx)}</div>
          </div>

          {/* Teléfono */}
          <div className="relative w-[108px] shrink-0 overflow-hidden rounded-[22px] p-[3px]" style={{ background: 'linear-gradient(180deg,#232a35,#141922)', boxShadow: '0 28px 56px -28px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.14)' }}>
            <div className="relative flex h-full flex-col overflow-hidden rounded-[19px] px-2 pb-2 pt-[18px]" style={{ background: 'linear-gradient(180deg, #0f151d 0%, #0a0f15 100%)' }}>
              <span className="absolute left-1/2 top-[6px] h-[6px] w-[26px] -translate-x-1/2 rounded-full bg-black" />
              <span className="absolute right-3 top-[7px] text-[4.5px] font-semibold tabular-nums" style={{ color: SCENE.text2 }}>
                9:41
              </span>
              {shown.app(ctx)}
            </div>
          </div>

          {/* Barrido de luz sobre el producto terminado (una vez por producto). */}
          <motion.div
            className="pointer-events-none absolute inset-y-0 w-[45%]"
            style={{ background: 'linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.075) 50%, rgba(255,255,255,0) 100%)' }}
            initial={{ x: '-140%', opacity: 0 }}
            animate={sweep ? { x: '260%', opacity: 1 } : { x: '-140%', opacity: 0 }}
            transition={sweep ? { x: { duration: 1.4, ease: [0.4, 0, 0.2, 1] }, opacity: { duration: 0.2 } } : { duration: 0 }}
          />
        </motion.div>
      </SceneFrame>
    </div>
  );
}
