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
 * HYDRATION-SAFETY (decisión F6B gate 6B): el servidor NO puede conocer la
 * preferencia de motion del usuario — `useReducedMotion()` SSRea siempre como
 * `false`. Para que el HTML del servidor y el del cliente coincidan SIEMPRE,
 * MotionSection nunca emite estilos "ocultos" en el SSR:
 *  - La ESTRUCTURA renderizada es IDÉNTICA en ambos modos: el wrapper es
 *    siempre el mismo `m.div.pf-motion`, tanto en `animate` como en `static`
 *    (reduced). Nunca se devuelven `children` pelados — eso cambiaría el árbol
 *    entre SSR (que ve `animate`) y un cliente reduced (`static`) y rompería
 *    la hidratación.
 *  - CERO props declarativas `initial`/`animate`/`whileInView` en el wrapper:
 *    esas son las que framer serializa como estilos inline en el SSR y la
 *    fuente real del mismatch. TODA revelación (tween primaria incluida) es
 *    IMPERATIVA y client-only: el estado oculto se aplica en `useLayoutEffect`
 *    (pre-paint) y se revela con `animate()` de `framer-motion/dom`.
 *  - Consecuencia buscada: el HTML del SSR muestra TODO el contenido VISIBLE
 *    (un visitante sin JS ve la sección completa, sin wrapper invisible). El
 *    trade-off aceptado es un breve FLASH visible entre el paint del SSR y la
 *    hidratación en clientes con motion activo (el contenido aparece visible y
 *    un instante después arranca su entrada). Es deliberado: se prefiere ese
 *    flash a un mismatch de hidratación y a ocultar contenido sin JS.
 *
 * Reglas rectoras (decididas en el plan F6B, implementadas al pie de la letra):
 *  - Reduced motion (`reducedMotionOverride ?? useReducedMotion() ?? false`)
 *    ⇒ el resolver devuelve `mode:"static"` ⇒ se renderiza el MISMO wrapper
 *    `m.div.pf-motion` pero INERTE: sin props de motion, sin efectos, sin
 *    transform, sin JS de animación. Garantía para reduced: nada aplica jamás
 *    estados ocultos ni animaciones en modo static. El `reducedMotionFallback`
 *    textual del schema es para humanos/IA — la implementación es "estático
 *    inmediato y visible".
 *  - Progressive enhancement: TODOS los estados "ocultos" (tween primaria,
 *    stagger, scroll-steps, count-up) se aplican en `useLayoutEffect`
 *    (pre-paint, sin flash de "salto"). SIN JS ese effect no corre y el
 *    contenido server-rendered queda VISIBLE — nunca se oculta con CSS
 *    estático ni con estilos inline del SSR.
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
 * `staggerChildren`) anima el wrapper (imperativamente, ver arriba). Un segundo
 * tween no escalonado (p.ej. `media-reveal` del hero, que apunta a `mediaAlt` —
 * un slot sin data-attr de motion) no tiene superficie DOM propia en v1 y no se
 * anima individualmente: el wrapper carga la entrada de la sección. Decisión de
 * v1 documentada, acotada por la superficie DOM de T5.
 *
 * Único gesto declarativo que sobrevive en el wrapper: el `pulse` de
 * INTERACCIÓN (`whileHover`/`whileTap`), y SOLO en modo `animate` — no emite
 * estilos inline en el SSR, así que es hydration-safe. El `pulse` in-view se
 * ejecuta imperativo (como la tween primaria).
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
import { animate, stagger, type AnimationPlaybackControls } from "framer-motion/dom";
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

  // La ESTRUCTURA es idéntica en ambos modos (hydration-safety, ver docstring):
  // siempre `LazyMotion > m.div.pf-motion`. En `static` el wrapper es INERTE
  // (sin props de motion, sin efectos): el contenido queda visible tal cual lo
  // dejó el server, sin transform ni JS de animación.
  return (
    <LazyMotion features={domAnimation} strict>
      {spec.mode === "static" ? (
        <m.div className="pf-motion" data-pf-motion-node={nodeId}>
          {children}
        </m.div>
      ) : (
        <MotionSectionRunner spec={spec} nodeId={nodeId}>
          {children}
        </MotionSectionRunner>
      )}
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
        applyKeyframeStyle(el, progress >= threshold ? scrollSeq.visible : scrollSeq.hidden, {
          durationMs: scrollSeq.durationMs,
          ease: scrollSeq.ease,
        });
      });
    },
    [scrollSeq]
  );
  useMotionValueEvent(scrollYProgress, "change", onScrollProgress);

  // --- Pre-paint: aplicar TODOS los estados "ocultos" SIN flash de salto ---
  // (progressive enhancement: sin JS este layout effect no corre y el
  //  contenido server-rendered queda visible; ver hydration-safety en el
  //  docstring del módulo). Cubre: la tween PRIMARIA sobre el HIJO del wrapper,
  //  los items de stagger/scroll-steps y las cifras de count-up.
  useLayoutEffect(() => {
    // Tween primaria: el estado oculto va sobre el HIJO del wrapper
    // (`motionTarget`), NUNCA sobre `ref.current` — el elemento observado por
    // useInView JAMÁS recibe estilos de motion — un clip-path/transform en el
    // target colapsa su intersectionRatio en Chromium y deja el trigger in-view
    // en deadlock (bug real del gate F6B). Sin transición inline — la
    // revelación imperativa la gobierna `animate()` con la duración/ease del
    // resolver.
    if (primary && ref.current) {
      applyKeyframeStyle(motionTarget(ref.current), primary.hidden);
    }
    const items = ref.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR);
    if (!items || items.length === 0) return;
    if (staggerSeq) {
      items.forEach((el) => applyKeyframeStyle(el, staggerSeq.hidden));
    } else if (scrollSeq) {
      items.forEach((el) =>
        applyKeyframeStyle(el, scrollSeq.hidden, { durationMs: scrollSeq.durationMs, ease: scrollSeq.ease })
      );
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

  // --- tween primaria: revelación IMPERATIVA del HIJO del wrapper ---
  // El estado oculto ya lo aplicó el pre-paint; aquí solo se anima hacia el
  // `visible` resuelto. trigger "load" ⇒ al montar; trigger "in-view" ⇒ cuando
  // `inView` (misma política once + amount:0.3 que el resto del runner). Anima
  // al HIJO, NO al wrapper observado por useInView (ver invariante en el
  // pre-paint: un clip-path/transform en el target lo deadlockea en Chromium).
  useEffect(() => {
    if (!primary) return;
    if (!ref.current) return;
    const el = motionTarget(ref.current);
    const shouldRun = primary.trigger === "load" ? true : inView;
    if (!shouldRun) return;
    const controls = animate(el, keyframeToTarget(primary.visible), {
      duration: toSeconds(primary.durationMs),
      ease: [...primary.ease],
      delay: toSeconds(primary.delayMs),
    });
    // Desmontar a mitad de animación no debe dejar la animación corriendo
    // contra un nodo ya detached (misma semántica de cleanup que stagger/count).
    return () => controls.stop();
  }, [primary, inView]);

  // --- pulse in-view: un ciclo de escala IMPERATIVO al entrar en view ---
  // (el pulse de interacción sigue declarativo — ver buildWrapperProps). Se
  // hace imperativo para NO usar `whileInView` declarativo en el wrapper, que
  // reintroduciría riesgo de estilos SSR y mismatch de hidratación.
  useEffect(() => {
    if (!pulseSeq || pulseSeq.pulseScale === undefined) return;
    if (pulseSeq.trigger === "interaction") return; // gesto declarativo, no aquí
    if (!inView) return;
    if (!ref.current) return;
    // Escala sobre el HIJO, NO sobre el wrapper observado: un scale en el target
    // también perturba la geometría de IO a mitad de ciclo (misma invariante que
    // la tween primaria — ver pre-paint).
    const el = motionTarget(ref.current);
    const controls = animate(el, { scale: [1, pulseSeq.pulseScale, 1] }, {
      duration: toSeconds(pulseSeq.durationMs),
      ease: [...pulseSeq.ease],
      delay: toSeconds(pulseSeq.delayMs),
    });
    return () => controls.stop();
  }, [pulseSeq, inView]);

  // --- stagger: entrada escalonada imperativa sobre [data-pf-motion-item] ---
  useEffect(() => {
    if (!staggerSeq) return;
    const shouldRun = staggerSeq.trigger === "load" ? true : inView;
    if (!shouldRun) return;
    const items = ref.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR);
    if (!items || items.length === 0) return;
    const controls = animate(Array.from(items), keyframeArrays(staggerSeq.hidden, staggerSeq.visible), {
      duration: toSeconds(staggerSeq.durationMs),
      ease: [...staggerSeq.ease],
      // stagger(childStaggerMs/1000): retraso incremental entre hijos; el
      // delayMs de la secuencia entra como arranque del escalonado.
      delay: stagger(toSeconds(staggerSeq.childStaggerMs), { startDelay: toSeconds(staggerSeq.delayMs) }),
    });
    // Desmontar a mitad de animación no debe dejar `onUpdate`/`onComplete`
    // corriendo contra nodos ya detached del DOM.
    return () => controls.stop();
  }, [staggerSeq, inView]);

  // --- count-up: 0→n al entrar en view, respetando prefijo/sufijo/formato ---
  useEffect(() => {
    if (!countSeq || !inView) return;
    const counts = ref.current?.querySelectorAll<HTMLElement>(COUNT_SELECTOR);
    if (!counts || counts.length === 0) return;
    // Una animación imperativa POR cifra: se retienen todos los controls para
    // poder detenerlos en el cleanup (ver nota de stagger arriba).
    const controls: AnimationPlaybackControls[] = [];
    counts.forEach((el) => {
      const parsed = parseCountTarget(el);
      if (!parsed) return; // no numérico ⇒ texto server intacto
      controls.push(
        animate(0, parsed.target, {
          duration: toSeconds(countSeq.durationMs),
          ease: [...countSeq.ease],
          onUpdate: (value: number) => {
            el.textContent = parsed.prefix + formatCount(value, parsed) + parsed.suffix;
          },
          // Al terminar, se restaura el texto EXACTO del server (`raw` del
          // data-attr, NO el `textContent` actual — que el pre-paint ya puso
          // en "0"): evita cualquier deriva de formateo frente a la cifra
          // original.
          onComplete: () => {
            el.textContent = parsed.raw;
          },
        })
      );
    });
    return () => {
      controls.forEach((c) => c.stop());
    };
  }, [countSeq, inView]);

  // --- Único gesto declarativo del wrapper: pulse de interacción (animate) ---
  // La tween primaria y el pulse in-view son imperativos (hydration-safety):
  // el wrapper NO recibe initial/animate/whileInView.
  const wrapperProps = buildWrapperProps(pulseSeq);

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

/**
 * Elemento que recibe los estilos/animaciones de motion PRIMARIA (tween e
 * in-view pulse): el PRIMER hijo del wrapper, con fallback al propio wrapper si
 * no hubiera hijos. INVARIANTE: el elemento observado por `useInView`
 * (`ref.current`) JAMÁS recibe estilos de motion — un clip-path/transform en el
 * target colapsa su intersectionRatio en Chromium y deja el trigger in-view en
 * deadlock (bug real del gate F6B). Por eso todo lo que oculta/anima va al hijo.
 */
function motionTarget(wrapper: HTMLElement): HTMLElement {
  return (wrapper.firstElementChild as HTMLElement | null) ?? wrapper;
}

type WrapperProps = Record<string, unknown>;

/**
 * ÚNICO gesto declarativo que el wrapper puede llevar: el pulse de INTERACCIÓN
 * (`whileHover`/`whileTap`). Es hydration-safe porque framer no emite estilos
 * inline en el SSR para estos gestos (solo `initial` lo haría, y ya no existe).
 * El pulse in-view NO entra aquí — se ejecuta imperativo en el runner. En modo
 * `static`/reduced este helper ni se invoca: el wrapper va sin props de motion.
 */
function buildWrapperProps(pulse: ResolvedSequence | undefined): WrapperProps {
  const props: WrapperProps = {};

  if (pulse && pulse.pulseScale !== undefined && pulse.trigger === "interaction") {
    // Pulso al interactuar: crece a pulseScale en hover, comprime en tap.
    // `transition` explícita con duración/ease del resolver — SIN ella framer
    // aplica su default y `motionDna.ritmo` (lento/rápido) deja de tener efecto
    // observable sobre el pulso de interacción (review final F6B, finding L1).
    const transition = { duration: toSeconds(pulse.durationMs), ease: [...pulse.ease] };
    props.whileHover = { scale: pulse.pulseScale, transition };
    props.whileTap = { scale: 1, transition };
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

/**
 * Keyframe → estilos inline (pre-paint / scroll-steps). Sin framer.
 *
 * `transition`, cuando se pasa, viene TAL CUAL del `ResolvedSequence` del
 * resolver (`durationMs`/`ease` — nunca recalculado aquí): scroll-steps es la
 * única superficie que hoy pasa este parámetro, así `motionDna.ritmo` (que
 * modula `durationMs` vía `RHYTHM_FACTOR`) y el `ease` cubic-bezier del
 * behavior tienen efecto real sobre la transición CSS del reveal — antes esta
 * función usaba un `400ms ease-out` hardcodeado que ignoraba ambos.
 */
function applyKeyframeStyle(
  el: HTMLElement,
  kf: MotionKeyframe,
  transition?: { durationMs: number; ease: readonly [number, number, number, number] }
): void {
  const transforms: string[] = [];
  if (kf.x !== undefined) transforms.push(`translateX(${kf.x}px)`);
  if (kf.y !== undefined) transforms.push(`translateY(${kf.y}px)`);
  if (kf.scale !== undefined) transforms.push(`scale(${kf.scale})`);
  if (transition) {
    const curve = `cubic-bezier(${transition.ease.join(",")})`;
    el.style.transition = `opacity ${transition.durationMs}ms ${curve}, transform ${transition.durationMs}ms ${curve}`;
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
