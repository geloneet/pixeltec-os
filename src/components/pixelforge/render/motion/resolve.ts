/**
 * Resolver de coreografía de motion — capa "Ejecución" de la arquitectura de
 * 3 capas de F6B (ver `.superpowers/sdd/f6b-context.md`). Traduce una
 * `choreography` validada estructuralmente (schema `compose-page-tree.ts`) +
 * el `motionDna` de la dirección elegida a un plan 100% numérico y
 * determinista — sin efectos, sin fechas/Math.random, sin DOM — que
 * `MotionSection` (F6B-T5, "use client" + framer-motion) simplemente ejecuta.
 *
 * Mismo patrón que `render/tokens.ts`: módulo puro testeable en entorno
 * `node`, cero React, cero framer-motion. La única dependencia RUNTIME es
 * `registry/behaviors.ts` (metadata plana, sin Zod). El schema de
 * `compose-page-tree.ts` (Zod v4) se importa `import type` únicamente — este
 * módulo no puede arrastrar Zod al bundle cliente del preview.
 *
 * Contrato de "nunca lanza" (mandato de Miguel, GO 2026-07-18):
 *  - `reducedMotion: true`            → `{mode:"static", sequences:[]}`.
 *  - `choreography` ausente o
 *    `sequences` vacío                → `{mode:"static", sequences:[]}`.
 *  - `behaviorId` no registrado en
 *    `CERTIFIED_BEHAVIORS`            → esa secuencia se descarta en
 *    silencio (defensa en profundidad: `validatePageTree` YA rechaza esto
 *    antes de llegar aquí, pero el resolver no debe asumirlo ciegamente). Si
 *    TODAS las secuencias se descartan, el resultado también es `static`.
 *  - `motionDna` ausente              → defaults `ritmo:"moderado"`,
 *    `intensidadGlobal:2`.
 */
import type { PageTree } from "@/lib/pixelforge/schemas/compose-page-tree";
import {
  getBehaviorDefinition,
  isRegisteredBehaviorId,
  type BehaviorId,
  type BehaviorRecipe,
  type MotionEase,
  type MotionKeyframe,
  type MotionTrigger,
} from "@/lib/pixelforge/registry/behaviors";

/** Único árbol de página del que se puede extraer una `choreography` — alias de conveniencia. */
type PageNode = PageTree["nodes"][number];

/** Forma exacta de `choreography` en el schema (Zod) — importada solo como tipo. */
export type ChoreographyInput = NonNullable<PageNode["choreography"]>;

/** Un elemento de `choreography.sequences` — lo que compone la IA por nodo. */
export type MotionSequenceInput = ChoreographyInput["sequences"][number];

/**
 * Intención de motion de la dirección elegida (`motionDna`, ya persistido).
 * Ambos campos son opcionales aquí porque el resolver debe tolerar un
 * `motionDna` parcial o ausente (defaults documentados abajo) — la fuente
 * real de este tipo vive en la persistencia de la dirección (F5/F7), no en
 * este módulo.
 */
export interface MotionDnaInput {
  ritmo?: "lento" | "moderado" | "rapido";
  intensidadGlobal?: 1 | 2 | 3;
}

/**
 * Una `MotionSequenceInput` ya resuelta a números concretos: amplitudes
 * escaladas, ease como cubic-bezier de 4 puntos, duración/delay en ms. Es lo
 * único que `MotionSection` necesita leer para animar — nunca vuelve a tocar
 * `motionDna`, `registry/behaviors.ts` ni el `recipe` crudo.
 */
export interface ResolvedSequence {
  behaviorId: BehaviorId;
  targetSlot: string;
  trigger: MotionTrigger;
  kind: BehaviorRecipe["kind"];
  /** Keyframe "oculto" con amplitudes YA escaladas. `{}` para `count-up`/`pulse` (no tienen hidden/visible). */
  hidden: MotionKeyframe;
  /** Keyframe "visible" con amplitudes YA escaladas. `{}` para `count-up`/`pulse`. */
  visible: MotionKeyframe;
  /** Cubic-bezier de 4 puntos — nunca el string `MotionEase` crudo. */
  ease: readonly [number, number, number, number];
  durationMs: number;
  delayMs: number;
  childStaggerMs: number;
  /** `recipe.staggerChildren` (fracción de segundos de framer-motion) si el behavior es `tween` con hijos escalonados; `undefined` en cualquier otro caso. */
  staggerChildren: number | undefined;
  /** Solo presente (clave incluida) cuando `kind === "pulse"`. */
  pulseScale?: number;
}

export interface ResolvedMotionSpec {
  mode: "animate" | "static";
  sequences: ResolvedSequence[];
}

// ---------------------------------------------------------------------------
// Constantes — EXACTAS al plan F6B (`.superpowers/sdd/task-f6b-4-brief.md`).
// Exportadas para que los tests construyan los valores esperados a partir de
// las mismas constantes que usa la implementación (evita duplicar "números
// mágicos" en el archivo de tests que puedan divergir en silencio).
// ---------------------------------------------------------------------------

/** Duración base en ms por `durationToken`, ANTES de aplicar el factor de ritmo. */
export const DURATION_MS_BY_TOKEN: Record<MotionSequenceInput["durationToken"], number> = {
  fast: 250,
  normal: 450,
  slow: 700,
};

/** Factor multiplicativo de `ritmo` — modula duración y todas las fórmulas de delay. */
export const RHYTHM_FACTOR: Record<NonNullable<MotionDnaInput["ritmo"]>, number> = {
  lento: 1.25,
  moderado: 1.0,
  rapido: 0.8,
};

/** Factor de amplitud por `intensity` (1-3) de la secuencia individual. */
export const AMPLITUDE_INTENSITY_FACTOR: Record<1 | 2 | 3, number> = {
  1: 0.6,
  2: 1.0,
  3: 1.5,
};

/** Factor de amplitud por `intensidadGlobal` (1-3) del `motionDna` de la dirección. */
export const GLOBAL_INTENSITY_FACTOR: Record<1 | 2 | 3, number> = {
  1: 0.85,
  2: 1.0,
  3: 1.15,
};

/** Cubic-bezier de 4 puntos por cada `MotionEase` que de hecho usan los behaviors v1. */
export const EASE_BEZIER: Record<MotionEase, readonly [number, number, number, number]> = {
  "ease-out": [0.16, 1, 0.3, 1],
  "ease-in-out": [0.65, 0, 0.35, 1],
};

/**
 * Ease lineal — no forma parte del set cerrado `MotionEase` de
 * `registry/behaviors.ts` (ningún `recipe` lo declara), pero el recipe
 * `count-up` no trae `ease` propio y `ResolvedSequence.ease` es un campo
 * siempre presente: este es el valor determinista que se usa en ese caso.
 */
export const LINEAR_EASE: readonly [number, number, number, number] = [0, 0, 1, 1];

/** `delayStrategy: "index"` — término por posición: `order × 90 × ritmo`. */
export const DELAY_INDEX_ORDER_MS = 90;
/** `delayStrategy: "index"` — término fijo de escalonado de hijos: `80 × ritmo` (mismo valor que `childStaggerMs`). */
export const DELAY_CHILD_STAGGER_BASE_MS = 80;
/** `delayStrategy: "distance"` — término por posición: `order × 120 × ritmo`. */
export const DELAY_DISTANCE_ORDER_MS = 120;
/** `delayStrategy: "distance"` — término fijo (aproximación determinista v1, sin grafo de distancia real): `110 × ritmo`. */
export const DELAY_DISTANCE_BASE_MS = 110;
/** `delayStrategy: "semantic"` — término fijo base: `250 × ritmo`. */
export const DELAY_SEMANTIC_BASE_MS = 250;
/** `delayStrategy: "semantic"` — término por posición: `order × 150 × ritmo`. */
export const DELAY_SEMANTIC_ORDER_MS = 150;

/** Defaults de `motionDna` cuando llega `undefined` o con campos ausentes. */
export const DEFAULT_RITMO: NonNullable<MotionDnaInput["ritmo"]> = "moderado";
export const DEFAULT_INTENSIDAD_GLOBAL: NonNullable<MotionDnaInput["intensidadGlobal"]> = 2;

const STATIC_SPEC: ResolvedMotionSpec = { mode: "static", sequences: [] };

/** Lleva cualquier número a uno de los 3 niveles cerrados 1|2|3 (defensa en profundidad — el schema ya restringe `intensity` a este rango). */
function clampLevel(value: number): 1 | 2 | 3 {
  if (value <= 1) return 1;
  if (value >= 3) return 3;
  return 2;
}

/**
 * Escala `x`, `y` y `(scale − 1)` por `factor`. `opacity` y `clipPath` pasan
 * SIN TOCAR — nunca se escalan (mandato explícito del plan: escalar la
 * opacidad rompería el propósito de fade, y `clipPath` es geometría de
 * barrido, no una amplitud).
 */
function scaleKeyframe(keyframe: MotionKeyframe, factor: number): MotionKeyframe {
  const scaled: MotionKeyframe = {};
  if (keyframe.opacity !== undefined) scaled.opacity = keyframe.opacity;
  if (keyframe.x !== undefined) scaled.x = keyframe.x * factor;
  if (keyframe.y !== undefined) scaled.y = keyframe.y * factor;
  if (keyframe.scale !== undefined) scaled.scale = 1 + (keyframe.scale - 1) * factor;
  if (keyframe.clipPath !== undefined) scaled.clipPath = keyframe.clipPath;
  return scaled;
}

/**
 * Delay en ms para una secuencia, según su `delayStrategy`. Redondeo: se
 * combinan todos los términos de la fórmula (en punto flotante) y se
 * redondea UNA sola vez con `Math.round` (mitad hacia +∞) al final — nunca
 * se redondean los términos intermedios por separado, para no acumular
 * error de redondeo. `childStaggerMs` ya viene redondeado, pero al ser
 * `80 × ritmo` con los 3 factores de ritmo del plan (1.25/1.0/0.8) su valor
 * es siempre un entero exacto, así que reutilizarlo aquí no introduce
 * ninguna divergencia frente a recalcular `80 × ritmo` inline.
 */
function resolveDelayMs(
  strategy: MotionSequenceInput["delayStrategy"],
  order: number,
  rhythmFactor: number,
  childStaggerMs: number
): number {
  switch (strategy) {
    case "none":
      return 0;
    case "index":
      return Math.round(order * DELAY_INDEX_ORDER_MS * rhythmFactor + childStaggerMs);
    case "distance":
      return Math.round(order * DELAY_DISTANCE_ORDER_MS * rhythmFactor + DELAY_DISTANCE_BASE_MS * rhythmFactor);
    case "semantic":
      return Math.round(DELAY_SEMANTIC_BASE_MS * rhythmFactor + order * DELAY_SEMANTIC_ORDER_MS * rhythmFactor);
    default:
      return 0;
  }
}

/**
 * Resuelve una `choreography` + `motionDna` a un `ResolvedMotionSpec` 100%
 * numérico. Puro y determinista: misma entrada → misma salida, siempre.
 * Nunca lanza (ver contrato en el doc-comment del módulo).
 */
export function resolveChoreography(
  choreography: ChoreographyInput | undefined,
  motionDna: MotionDnaInput | undefined,
  reducedMotion: boolean
): ResolvedMotionSpec {
  if (reducedMotion) return STATIC_SPEC;
  if (!choreography || choreography.sequences.length === 0) return STATIC_SPEC;

  const ritmo = motionDna?.ritmo ?? DEFAULT_RITMO;
  const intensidadGlobal = motionDna?.intensidadGlobal ?? DEFAULT_INTENSIDAD_GLOBAL;
  const rhythmFactor = RHYTHM_FACTOR[ritmo];
  const globalFactor = GLOBAL_INTENSITY_FACTOR[clampLevel(intensidadGlobal)];
  const childStaggerMs = Math.round(DELAY_CHILD_STAGGER_BASE_MS * rhythmFactor);

  // Orden determinista por `order` ANTES de descartar behaviorIds no
  // registrados — así el orden final no depende de qué se descarte.
  const orderedInput = [...choreography.sequences].sort((a, b) => a.order - b.order);

  const sequences: ResolvedSequence[] = [];
  for (const seq of orderedInput) {
    // Defensa en profundidad: `validatePageTree` ya rechaza un `behaviorId`
    // no registrado antes de que el árbol llegue aquí, pero el resolver no
    // debe asumirlo — se descarta en silencio, nunca lanza.
    if (!isRegisteredBehaviorId(seq.behaviorId)) continue;

    const definition = getBehaviorDefinition(seq.behaviorId);
    const recipe = definition.recipe;
    const amplitudeFactor = AMPLITUDE_INTENSITY_FACTOR[clampLevel(seq.intensity)] * globalFactor;

    let hidden: MotionKeyframe = {};
    let visible: MotionKeyframe = {};
    let ease: readonly [number, number, number, number] = LINEAR_EASE;
    let staggerChildren: number | undefined;
    let pulseScale: number | undefined;

    switch (recipe.kind) {
      case "tween":
        hidden = scaleKeyframe(recipe.hidden, amplitudeFactor);
        visible = scaleKeyframe(recipe.visible, amplitudeFactor);
        ease = EASE_BEZIER[recipe.ease];
        staggerChildren = recipe.staggerChildren;
        break;
      case "scroll-steps":
        hidden = scaleKeyframe(recipe.hidden, amplitudeFactor);
        visible = scaleKeyframe(recipe.visible, amplitudeFactor);
        ease = EASE_BEZIER[recipe.ease];
        break;
      case "pulse":
        ease = EASE_BEZIER[recipe.ease];
        pulseScale = 1 + (recipe.scaleAmplitude - 1) * amplitudeFactor;
        break;
      case "count-up":
        // Sin `hidden`/`visible`/`ease` propios en el recipe — se queda en
        // los defaults declarados arriba ({}, {}, LINEAR_EASE).
        break;
    }

    sequences.push({
      behaviorId: seq.behaviorId,
      targetSlot: seq.targetSlot,
      trigger: seq.trigger,
      kind: recipe.kind,
      hidden,
      visible,
      ease,
      durationMs: Math.round(DURATION_MS_BY_TOKEN[seq.durationToken] * rhythmFactor),
      delayMs: resolveDelayMs(seq.delayStrategy, seq.order, rhythmFactor, childStaggerMs),
      childStaggerMs,
      staggerChildren,
      ...(pulseScale !== undefined ? { pulseScale } : {}),
    });
  }

  if (sequences.length === 0) return STATIC_SPEC;

  return { mode: "animate", sequences };
}
