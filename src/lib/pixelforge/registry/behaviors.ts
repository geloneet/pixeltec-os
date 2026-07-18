/**
 * Motion Behavior Registry v1 — metadata pura, SIN Zod (a diferencia de
 * `capabilities.ts` y `blocks.ts`): este módulo lo importa el bundle CLIENTE
 * del preview (`MotionSection`, F6B-T3) para resolver cada `behaviorId` de la
 * `choreography` a keyframes reales, así que se mantiene deliberadamente
 * ligero — interfaces + datos planos, cero dependencias.
 *
 * Es la capa "capacidad" de la arquitectura de 3 capas del plan F6B (ver
 * `.superpowers/sdd/f6b-context.md`): la IA (capa "intención",
 * `compose_page_tree`) solo puede referenciar un `behaviorId` de este
 * catálogo — nunca puede describir una animación arbitraria. `recipe` es
 * DATO puro (una unión discriminada de keyframes/parámetros), nunca código:
 * el resolver de F6B-T2 (`render/motion/resolve.ts`) es el único que
 * traduce estos datos a algo que framer-motion ejecuta.
 *
 * `validatePageTree` (`./validate-page-tree.ts:~130`) ya NO emite un WARNING
 * "suave" para `behaviorId` — F6B-T2 promovió ese warning a error real usando
 * `isRegisteredBehaviorId` de este archivo.
 */

/**
 * Mismo set de 4 triggers que el enum `trigger` de `motionSequenceSchema`
 * (`src/lib/pixelforge/schemas/compose-page-tree.ts:14`). Se declara aquí
 * como unión de literales (no se importa el schema zod/v4: este archivo
 * vive fuera de `schemas/` y no puede tirar de zod al bundle cliente) — si
 * el enum del schema cambia, este tipo debe actualizarse en el mismo commit.
 */
export type MotionTrigger = "load" | "in-view" | "interaction" | "scroll-progress";

/**
 * Easing cerrado a los dos valores que de hecho usan los 8 behaviors v1.
 * Ampliar este set (p.ej. `ease-in`) es una decisión de diseño de motion,
 * no un detalle de implementación — se hace a propósito, no "por si acaso".
 */
export type MotionEase = "ease-out" | "ease-in-out";

/**
 * Set cerrado de propiedades animables — todas las recetas `tween` y
 * `scroll-steps` solo pueden tocar estas claves. Cerrado a propósito: es lo
 * que garantiza que `recipe` sea DATO (nunca un arbitrary style object) y lo
 * que el resolver de F6B-T2 sabe traducir 1:1 a props de framer-motion
 * (`opacity`/`x`/`y`/`scale`/`clipPath`).
 */
export interface MotionKeyframe {
  opacity?: number;
  x?: number;
  y?: number;
  scale?: number;
  clipPath?: string;
}

/**
 * Receta de motion — unión discriminada por `kind` (mismo patrón que usan
 * `AnalyzeReferenceRequest`/`GenerateDirectionsRequest` en `ai/prompts/` y
 * `SafeFetchResult` en `visual/safe-fetch.ts` para uniones TS planas sin
 * Zod). Nunca contiene funciones — cada variante es serializable a JSON.
 */
export type BehaviorRecipe =
  | { kind: "tween"; hidden: MotionKeyframe; visible: MotionKeyframe; ease: MotionEase; staggerChildren?: number }
  | { kind: "pulse"; scaleAmplitude: number; ease: MotionEase }
  | { kind: "count-up" }
  | { kind: "scroll-steps"; hidden: MotionKeyframe; visible: MotionKeyframe; ease: MotionEase };

export interface MotionBehaviorDefinition {
  id: string;
  name: string;
  /** Explicación en español de qué hace visualmente el behavior. */
  description: string;
  /** Triggers válidos para este behavior — subconjunto no vacío del enum `trigger` del schema. */
  allowedTriggers: readonly MotionTrigger[];
  /** `motionIntents` de `blocks.ts` que este behavior puede satisfacer. */
  coversIntents: readonly string[];
  recipe: BehaviorRecipe;
  /** Si `true`, solo puede usarse en un nodo cuyo block tenga `allowsCinematic:true`. */
  cinematicOnly: boolean;
  /** Guía en español para la IA sobre cuándo elegir este behavior. */
  aiHint: string;
}

/**
 * 8 behaviors v1 — cubren los 14 `motionIntents` declarados por los 12
 * blocks de `blocks.ts` (verificado por el test de paridad en
 * `behaviors.test.ts`, que itera `PIXELFORGE_BLOCKS` real, no una copia).
 */
export const CERTIFIED_BEHAVIORS: readonly MotionBehaviorDefinition[] = [
  {
    id: "fade-rise",
    name: "Aparición con elevación",
    description: "El elemento aparece desvaneciendo desde opacidad 0 y sube 24px hasta su posición final.",
    allowedTriggers: ["load", "in-view"],
    coversIntents: ["fade-up", "kicker-reveal"],
    recipe: {
      kind: "tween",
      hidden: { opacity: 0, y: 24 },
      visible: { opacity: 1, y: 0 },
      ease: "ease-out",
    },
    cinematicOnly: false,
    aiHint:
      "Behavior por defecto para titulares y kickers que necesitan entrada con peso — reutiliza el nombre del placeholder del fixture F6A.",
  },
  {
    id: "fade-in",
    name: "Aparición simple",
    description: "El elemento pasa de opacidad 0 a 1 sin desplazamiento, con easing suave de entrada y salida.",
    allowedTriggers: ["load", "in-view"],
    coversIntents: ["fade-in", "quote-swap"],
    recipe: {
      kind: "tween",
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
      ease: "ease-in-out",
    },
    cinematicOnly: false,
    aiHint:
      "Úsalo para bloques de bajo protagonismo (FAQ, footer, testimonios) donde el movimiento no debe competir con el contenido. En v1 también cubre 'quote-swap': el intercambio interactivo real de citas es post-v1 (documentado aquí, no implementado).",
  },
  {
    id: "stagger-children",
    name: "Entrada escalonada de hijos",
    description: "Cada hijo del contenedor aparece con opacidad 0→1 y sube 16px, escalonado en el tiempo respecto al anterior.",
    allowedTriggers: ["load", "in-view"],
    coversIntents: ["stagger-badges", "stagger-logos", "stagger-tiers", "stagger-features", "stagger-steps"],
    recipe: {
      kind: "tween",
      hidden: { opacity: 0, y: 16 },
      visible: { opacity: 1, y: 0 },
      ease: "ease-out",
      staggerChildren: 0.08,
    },
    cinematicOnly: false,
    aiHint:
      "Behavior por defecto para cualquier lista/grid de elementos repetidos (badges, logos, tiers, features, pasos) — nunca los anima todos a la vez.",
  },
  {
    id: "media-reveal",
    name: "Revelación de media",
    description: "La imagen/video aparece con opacidad 0→1 y un leve zoom-out de escala 1.05→1.",
    allowedTriggers: ["load", "in-view"],
    coversIntents: ["media-reveal"],
    recipe: {
      kind: "tween",
      hidden: { opacity: 0, scale: 1.05 },
      visible: { opacity: 1, scale: 1 },
      ease: "ease-out",
    },
    cinematicOnly: false,
    aiHint: "Úsalo para la media principal de un hero — el zoom-out sutil da sensación de foco sin distraer del copy.",
  },
  {
    id: "count-up",
    name: "Conteo ascendente",
    description: "El valor numérico cuenta de 0 hasta su cifra final mientras el bloque entra en el viewport.",
    allowedTriggers: ["in-view"],
    coversIntents: ["count-up"],
    recipe: { kind: "count-up" },
    cinematicOnly: false,
    aiHint: "Único behavior certificado para cifras/estadísticas — nunca combinarlo con un trigger distinto a in-view.",
  },
  {
    id: "scroll-reveal-steps",
    name: "Revelación de pasos por scroll",
    description: "Cada paso aparece con opacidad 0→1 y sube 20px conforme el usuario avanza el scroll por la secuencia.",
    allowedTriggers: ["scroll-progress", "in-view"],
    coversIntents: ["scroll-progress", "step-reveal"],
    recipe: {
      kind: "scroll-steps",
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0 },
      ease: "ease-out",
    },
    cinematicOnly: false,
    aiHint: "Único behavior certificado para narrative-scroller — liga la revelación de cada paso al progreso real del scroll, no a un timer.",
  },
  {
    id: "pulse-accent",
    name: "Pulso de acento",
    description: "El elemento late suavemente entre escala 1 y 1.03 para llamar la atención sin ser intrusivo.",
    allowedTriggers: ["in-view", "interaction"],
    coversIntents: ["pulse-cta"],
    recipe: { kind: "pulse", scaleAmplitude: 1.03, ease: "ease-in-out" },
    cinematicOnly: false,
    aiHint: "Resérvalo para el CTA de cierre más importante de la landing — usarlo en más de un elemento por página anula su efecto de énfasis.",
  },
  {
    id: "wipe-reveal",
    name: "Revelación por barrido",
    description: "El elemento se revela con un barrido de clip-path de derecha a izquierda, de completamente oculto a visible.",
    allowedTriggers: ["load", "in-view"],
    coversIntents: ["fade-up", "media-reveal"],
    recipe: {
      kind: "tween",
      hidden: { clipPath: "inset(0 100% 0 0)" },
      visible: { clipPath: "inset(0)" },
      ease: "ease-out",
    },
    cinematicOnly: true,
    aiHint:
      "Behavior cinematográfico (intensity 3) — solo en nodos cuyo block tenga allowsCinematic:true (p.ej. hero-split). Reserva su uso al Signature Motif de la dirección elegida, no lo generalices.",
  },
] as const;

export const BEHAVIOR_IDS = CERTIFIED_BEHAVIORS.map((behavior) => behavior.id);
export type BehaviorId = (typeof BEHAVIOR_IDS)[number];

export function isRegisteredBehaviorId(value: string): value is BehaviorId {
  return (BEHAVIOR_IDS as string[]).includes(value);
}

export function getBehaviorDefinition(id: BehaviorId): MotionBehaviorDefinition {
  const definition = CERTIFIED_BEHAVIORS.find((behavior) => behavior.id === id);
  if (!definition) {
    throw new Error(`Behavior no registrado en CERTIFIED_BEHAVIORS: "${id}"`);
  }
  return definition;
}

/**
 * Texto en español para inyectar en el prompt de `compose_page_tree` (F7):
 * qué behaviors existen, qué intents cubren y con qué triggers — el único
 * catálogo de motion del que la IA puede elegir un `behaviorId`.
 */
export function getBehaviorsForPrompt(): string {
  return CERTIFIED_BEHAVIORS.map((behavior) => {
    const cinematico = behavior.cinematicOnly ? " (cinematográfico, solo blocks con allowsCinematic)" : "";
    return `- ${behavior.id} — ${behavior.name}${cinematico}. Intents: ${behavior.coversIntents.join(
      ", "
    )}. Triggers: ${behavior.allowedTriggers.join(", ")}.`;
  }).join("\n");
}
