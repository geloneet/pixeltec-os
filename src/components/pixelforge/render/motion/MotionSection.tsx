"use client";

/**
 * MotionSection — capa "Ejecución" cliente de la arquitectura de 3 capas de
 * F6B (ver `.superpowers/sdd/f6b-context.md`). Es el ÚNICO punto del repo que
 * ejecuta framer-motion para la landing: envuelve un block server-rendered y,
 * a partir del `ResolvedMotionSpec` que produce el resolver PURO
 * (`resolve.ts`), interpreta la coreografía. Nunca re-calcula amplitudes,
 * duraciones ni delays — el resolver ya los dejó 100% numéricos; aquí solo se
 * traducen a props/llamadas de framer.
 *
 * Reglas rectoras (decididas en el plan F6B, implementadas al pie de la letra):
 *  - Reduced motion (`reducedMotionOverride ?? useReducedMotion() ?? false`)
 *    ⇒ el resolver devuelve `mode:"static"` ⇒ se devuelven los `children`
 *    DIRECTOS: cero wrapper, cero transform, cero JS de animación. El
 *    `reducedMotionFallback` textual del schema es para humanos/IA — la
 *    implementación es "estático inmediato".
 *  - Progressive enhancement: los estados "ocultos" (stagger/scroll-steps) se
 *    aplican en `useLayoutEffect` (pre-paint, sin flash). SIN JS el contenido
 *    server-rendered queda VISIBLE — nunca se oculta con CSS estático.
 *  - Bundle: `LazyMotion features={domAnimation} strict` + `m.div` (nunca
 *    `motion.*`, que rompe en `strict`). Las animaciones imperativas usan
 *    `animate`/`stagger` de `framer-motion/dom` (fuera del árbol declarativo).
 *
 * Superficie DOM (contrato con F6B-T5): los blocks solo exponen
 *  - `[data-pf-motion-item]`   — elementos repetidos (stagger / scroll-steps).
 *  - `[data-pf-motion-count]`  — valor crudo de cada cifra (count-up).
 * MotionSection NO conoce la estructura interna de ningún block: solo estos
 * dos selectores + el wrapper que envuelve al block.
 *
 * Solo la secuencia PRIMARIA (menor `order`, `kind:"tween"` SIN
 * `staggerChildren`) anima declarativamente el wrapper. Un segundo tween no
 * escalonado (p.ej. `media-reveal` del hero, que apunta a `mediaAlt` — un slot
 * sin data-attr de motion) no tiene superficie DOM propia en v1 y no se anima
 * individualmente: el wrapper carga la entrada de la sección. Decisión de v1
 * documentada, acotada por la superficie DOM de T5.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import {
  LazyMotion,
  domAnimation,
  m,
  useInView,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "framer-motion";
import { animate, stagger } from "framer-motion/dom";
import {
  resolveChoreography,
  type ChoreographyInput,
  type MotionDnaInput,
  type ResolvedMotionSpec,
  type ResolvedSequence,
} from "./resolve";
import type { BehaviorRecipe, MotionKeyframe } from "@/lib/pixelforge/registry/behaviors";

/**
 * Kinds de `BehaviorRecipe` que MotionSection sabe ejecutar. Exportado para el
 * test de PARIDAD registry↔renderer: `SUPPORTED_RECIPE_KINDS ⊇ kinds` de
 * `CERTIFIED_BEHAVIORS`. Si el registry añade un `kind` nuevo, este array debe
 * crecer en el mismo commit o el test de paridad se pone rojo — es la red que
 * garantiza que ningún behavior certificado quede sin ejecutor.
 */
export const SUPPORTED_RECIPE_KINDS = [
  "tween",
  "pulse",
  "count-up",
  "scroll-steps",
] as const satisfies readonly BehaviorRecipe["kind"][];

export interface MotionSectionProps {
  nodeId: string;
  choreography: ChoreographyInput | undefined;
  motionDna?: MotionDnaInput;
  /**
   * SOLO para tests: fuerza el estado de reduced-motion sin depender del
   * media query del entorno. En producción es `undefined` y manda
   * `useReducedMotion()`.
   */
  reducedMotionOverride?: boolean;
  children: ReactNode;
}

/** Selector de elementos repetidos (stagger / scroll-steps). */
const ITEM_SELECTOR = "[data-pf-motion-item]";
/** Selector de cifras a contar (count-up). */
const COUNT_SELECTOR = "[data-pf-motion-count]";

/** ms→s (framer trabaja en segundos; el resolver entrega enteros en ms). */
const toSeconds = (ms: number): number => ms / 1000;

export function MotionSection({
  nodeId,
  choreography,
  motionDna,
  reducedMotionOverride,
  children,
}: MotionSectionProps): ReactNode {
  // Regla de hooks: SIEMPRE se llama, aunque el override lo ignore.
  const hookReduced = useReducedMotion();
  const reduced = reducedMotionOverride ?? hookReduced ?? false;

  const spec = resolveChoreography(choreography, motionDna, reduced);

  // Reduced / sin coreografía ejecutable ⇒ children directos: cero wrapper,
  // cero transform, cero JS. Contenido visible tal cual lo dejó el server.
  if (spec.mode === "static") {
    return <>{children}</>;
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionSectionRunner spec={spec} nodeId={nodeId}>
        {children}
      </MotionSectionRunner>
    </LazyMotion>
  );
}

/**
 * Runner interno — solo se monta cuando `mode:"animate"`, así sus hooks
 * (useInView/useScroll/…) nunca se ejecutan en la rama static (no violan las
 * reglas de hooks porque montar/desmontar un hijo es válido).
 */
function MotionSectionRunner({
  spec,
  nodeId,
  children,
}: {
  spec: ResolvedMotionSpec;
  nodeId: string;
  children: ReactNode;
}): ReactNode {
  const ref = useRef<HTMLDivElement>(null);

  // Clasificación de secuencias por ejecutor. `spec.sequences` ya viene
  // ordenado por `order` (contrato del resolver).
  const primary = spec.sequences.find((s) => s.kind === "tween" && s.staggerChildren === undefined);
  const staggerSeq = spec.sequences.find((s) => s.kind === "tween" && s.staggerChildren !== undefined);
  const countSeq = spec.sequences.find((s) => s.kind === "count-up");
  const scrollSeq = spec.sequences.find((s) => s.kind === "scroll-steps");
  const pulseSeq = spec.sequences.find((s) => s.kind === "pulse");

  // Un único gesto in-view para todo el runner (dispara los ejecutores
  // imperativos de trigger "in-view"). `once` + `amount:0.3` = misma política
  // que el wrapper declarativo.
  const inView = useInView(ref, { once: true, amount: 0.3 });

  // useScroll SIEMPRE se llama (regla de hooks); solo scroll-steps lo consume.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.8", "end 0.5"],
  });

  // --- scroll-steps: liga la revelación de cada item al progreso real ---
  const onScrollProgress = useCallback(
    (progress: number) => {
      if (!scrollSeq) return;
      const items = ref.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR);
      if (!items || items.length === 0) return;
      const n = items.length;
      items.forEach((el, i) => {
        // item i visible cuando progress ≥ (i+1)/(n+1): reparte los umbrales
        // dentro de la ventana de scroll sin que el primero requiera 0 ni el
        // último requiera 1.
        const threshold = (i + 1) / (n + 1);
        applyKeyframeStyle(el, progress >= threshold ? scrollSeq.visible : scrollSeq.hidden, true);
      });
    },
    [scrollSeq]
  );
  useMotionValueEvent(scrollYProgress, "change", onScrollProgress);

  // --- Pre-paint: ocultar los items de stagger/scroll-steps SIN flash ---
  // (progressive enhancement: sin JS este layout effect no corre y el
  //  contenido server-rendered queda visible).
  useLayoutEffect(() => {
    const items = ref.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR);
    if (!items || items.length === 0) return;
    if (staggerSeq) {
      items.forEach((el) => applyKeyframeStyle(el, staggerSeq.hidden, false));
    } else if (scrollSeq) {
      items.forEach((el) => applyKeyframeStyle(el, scrollSeq.hidden, true));
    }
    // Pre-paint: cifras count-up arrancan en su valor formateado a 0.
    if (countSeq) {
      const counts = ref.current?.querySelectorAll<HTMLElement>(COUNT_SELECTOR);
      counts?.forEach((el) => {
        const parsed = parseCountTarget(el);
        if (parsed) el.textContent = parsed.prefix + formatCount(0, parsed) + parsed.suffix;
      });
    }
    // Solo debe correr al montar (los ids de secuencia no cambian en vida del
    // componente porque el árbol es estático dentro de un preview).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- stagger: entrada escalonada imperativa sobre [data-pf-motion-item] ---
  useEffect(() => {
    if (!staggerSeq) return;
    const shouldRun = staggerSeq.trigger === "load" ? true : inView;
    if (!shouldRun) return;
    const items = ref.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR);
    if (!items || items.length === 0) return;
    animate(Array.from(items), keyframeArrays(staggerSeq.hidden, staggerSeq.visible), {
      duration: toSeconds(staggerSeq.durationMs),
      ease: [...staggerSeq.ease],
      // stagger(childStaggerMs/1000): retraso incremental entre hijos; el
      // delayMs de la secuencia entra como arranque del escalonado.
      delay: stagger(toSeconds(staggerSeq.childStaggerMs), { startDelay: toSeconds(staggerSeq.delayMs) }),
    });
  }, [staggerSeq, inView]);

  // --- count-up: 0→n al entrar en view, respetando prefijo/sufijo/formato ---
  useEffect(() => {
    if (!countSeq || !inView) return;
    const counts = ref.current?.querySelectorAll<HTMLElement>(COUNT_SELECTOR);
    if (!counts || counts.length === 0) return;
    counts.forEach((el) => {
      const parsed = parseCountTarget(el);
      if (!parsed) return; // no numérico ⇒ texto server intacto
      animate(0, parsed.target, {
        duration: toSeconds(countSeq.durationMs),
        ease: [...countSeq.ease],
        onUpdate: (value: number) => {
          el.textContent = parsed.prefix + formatCount(value, parsed) + parsed.suffix;
        },
        // Al terminar, se restaura el texto EXACTO del server (`raw` del
        // data-attr, NO el `textContent` actual — que el pre-paint ya puso en
        // "0"): evita cualquier deriva de formateo frente a la cifra original.
        onComplete: () => {
          el.textContent = parsed.raw;
        },
      });
    });
  }, [countSeq, inView]);

  // --- Wrapper declarativo: secuencia primaria (tween sin stagger) + pulse ---
  const wrapperProps = buildWrapperProps(primary, pulseSeq);

  return (
    <m.div ref={ref} className="pf-motion" data-pf-motion-node={nodeId} {...wrapperProps}>
      {children}
    </m.div>
  );
}

// ---------------------------------------------------------------------------
// Helpers puros (sin React) — traducen keyframes numéricos a props de framer
// o a estilos inline. No re-calculan nada: consumen lo que dejó el resolver.
// ---------------------------------------------------------------------------

type WrapperProps = Record<string, unknown>;

/**
 * Props declarativas del wrapper: la secuencia primaria (initial/animate en
 * "load", initial/whileInView+viewport en "in-view") + el pulse
 * (whileHover/whileTap en "interaction", ciclo único en "in-view").
 */
function buildWrapperProps(
  primary: ResolvedSequence | undefined,
  pulse: ResolvedSequence | undefined
): WrapperProps {
  const props: WrapperProps = {};

  if (primary) {
    const transition = {
      duration: toSeconds(primary.durationMs),
      delay: toSeconds(primary.delayMs),
      ease: [...primary.ease] as number[],
    };
    props.initial = keyframeToTarget(primary.hidden);
    if (primary.trigger === "load") {
      props.animate = keyframeToTarget(primary.visible);
      props.transition = transition;
    } else {
      // in-view (único otro trigger válido para tween): revela una sola vez.
      props.whileInView = keyframeToTarget(primary.visible);
      props.viewport = { once: true, amount: 0.3 };
      props.transition = transition;
    }
  }

  if (pulse && pulse.pulseScale !== undefined) {
    if (pulse.trigger === "interaction") {
      // Pulso al interactuar: crece a pulseScale en hover, comprime en tap.
      props.whileHover = { scale: pulse.pulseScale };
      props.whileTap = { scale: 1 };
    } else {
      // Pulso in-view: un ciclo de escala al entrar. Si hay primaria in-view,
      // comparte transición pero no colisiona de claves (primaria usa
      // opacity/y/clipPath, el pulso usa scale) — aceptable en v1.
      const whileInView = (props.whileInView as Record<string, unknown> | undefined) ?? {};
      props.whileInView = { ...whileInView, scale: [1, pulse.pulseScale, 1] };
      props.viewport = props.viewport ?? { once: true, amount: 0.3 };
      props.transition = props.transition ?? {
        duration: toSeconds(pulse.durationMs),
        delay: toSeconds(pulse.delayMs),
      };
    }
  }

  return props;
}

/** Keyframe → target declarativo de framer (`x`/`y`/`scale` como props nativas). */
function keyframeToTarget(kf: MotionKeyframe): Record<string, number | string> {
  const target: Record<string, number | string> = {};
  if (kf.opacity !== undefined) target.opacity = kf.opacity;
  if (kf.x !== undefined) target.x = kf.x;
  if (kf.y !== undefined) target.y = kf.y;
  if (kf.scale !== undefined) target.scale = kf.scale;
  if (kf.clipPath !== undefined) target.clipPath = kf.clipPath;
  return target;
}

/** Par hidden→visible como arrays de keyframes para `animate` imperativo. */
function keyframeArrays(hidden: MotionKeyframe, visible: MotionKeyframe): Record<string, unknown[]> {
  const keys: (keyof MotionKeyframe)[] = ["opacity", "x", "y", "scale", "clipPath"];
  const out: Record<string, unknown[]> = {};
  for (const k of keys) {
    const h = hidden[k];
    const v = visible[k];
    if (h !== undefined || v !== undefined) {
      out[k] = [h ?? v, v ?? h];
    }
  }
  return out;
}

/** Keyframe → estilos inline (pre-paint / scroll-steps). Sin framer. */
function applyKeyframeStyle(el: HTMLElement, kf: MotionKeyframe, withTransition: boolean): void {
  const transforms: string[] = [];
  if (kf.x !== undefined) transforms.push(`translateX(${kf.x}px)`);
  if (kf.y !== undefined) transforms.push(`translateY(${kf.y}px)`);
  if (kf.scale !== undefined) transforms.push(`scale(${kf.scale})`);
  if (withTransition) {
    el.style.transition = "opacity 400ms ease-out, transform 400ms ease-out";
  }
  if (transforms.length > 0) el.style.transform = transforms.join(" ");
  if (kf.opacity !== undefined) el.style.opacity = String(kf.opacity);
  if (kf.clipPath !== undefined) el.style.clipPath = kf.clipPath;
}

interface ParsedCount {
  /** Texto crudo del data-attr — la cifra final EXACTA a restaurar. */
  raw: string;
  prefix: string;
  suffix: string;
  target: number;
  decimals: number;
  grouped: boolean;
}

/**
 * Parsea `data-pf-motion-count` (p.ej. "120+", "98%", "1,250"). No numérico
 * (sin cifras) ⇒ `null`: el llamador deja el texto server intacto.
 */
function parseCountTarget(el: HTMLElement): ParsedCount | null {
  const raw = el.getAttribute("data-pf-motion-count") ?? el.textContent ?? "";
  const match = raw.match(/^([^\d]*)([\d.,]+)(.*)$/);
  if (!match) return null;
  const [, prefix, numStr, suffix] = match;
  const target = Number.parseFloat(numStr.replace(/,/g, ""));
  if (!Number.isFinite(target)) return null;
  const decimals = numStr.includes(".") ? (numStr.split(".")[1]?.length ?? 0) : 0;
  return { raw, prefix, suffix, target, decimals, grouped: numStr.includes(",") };
}

/** Formatea un valor intermedio del conteo con los mismos decimales/agrupado. */
function formatCount(value: number, parsed: ParsedCount): string {
  const fixed = value.toFixed(parsed.decimals);
  if (!parsed.grouped) return fixed;
  const [intPart, decPart] = fixed.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${grouped}.${decPart}` : grouped;
}
