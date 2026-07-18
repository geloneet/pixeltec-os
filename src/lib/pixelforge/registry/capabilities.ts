/**
 * Signature Capability Registry — F5 dejó SOLO metadata (server-safe, sin
 * React, sin "use client"). El plan maestro exige validar `signatureComponent`
 * de cada dirección creativa "contra Capability Registry (o
 * custom-development-required)": este módulo es esa fuente de verdad.
 *
 * F6C (T1) extiende el registry de forma ADITIVA con los campos que necesita
 * la capa client real: `version`, `purpose`, `acceptanceCriteria`,
 * `certification` y `allowsChoreography` (ver docstring de
 * `SignatureCapabilityDefinition`). Las implementaciones CLIENT (render real
 * de cada capability en `render/capabilities/`, wiring a `blocks`/`behaviors`)
 * son tareas T3/T4/T5 de F6C y NO viven en este archivo.
 *
 * Semántica de `fallbackComponentId` (D2, remapeado a blocks REALES en F6C):
 * es el `BlockId` estático que el árbol usa cuando una capability no puede
 * montarse. Composición con datos insuficientes para la capability es
 * decisión del composer de F7 (este registry no proyecta props especulativas
 * hacia el fallback); props inválidas en `validatePageTree` son un árbol
 * RECHAZADO (nunca degradan a "fallback" — eso ocurriría después de aceptar
 * un árbol inválido); en runtime, el fallback es SSR estático completo sin
 * JS, degradado a una representación estática con props degeneradas si el
 * componente real lanza, envuelto en `SectionErrorBoundary`.
 *
 * Nota de versión de Zod: este archivo vive FUERA de `src/lib/pixelforge/schemas/`
 * (no es un output schema de Structured Outputs), así que usa `"zod"` clásico
 * (v3) — igual que el resto del repo. `zod/v4` está reservado a
 * `src/lib/pixelforge/schemas/` y `KIND_SCHEMAS` (ver docstring de
 * `schemas/index.ts`); no se mezcla aquí.
 */
import { z } from "zod";
import type { BlockId } from "./blocks";

/**
 * Las 8 categorías del plan maestro. Solo 4 tienen una capability certificada
 * en v1 (`coverage-map`, `comparison`, `selector`, `process-visualizer`) — las
 * otras 4 (`calculator`, `timeline`, `configurator`, `before-after`) existen
 * únicamente como valores válidos del type: si la IA propone un
 * `signatureComponent` para una de ellas, el schema de dominio la fuerza a
 * responder `custom-development-required` (no hay `capabilityId` que pueda
 * satisfacerla porque `CAPABILITY_IDS` no tiene ninguna entrada de esas
 * categorías).
 */
export const SIGNATURE_CAPABILITY_CATEGORIES = [
  "coverage-map",
  "comparison",
  "selector",
  "process-visualizer",
  "calculator",
  "timeline",
  "configurator",
  "before-after",
] as const;

export type SignatureCapabilityCategory = (typeof SIGNATURE_CAPABILITY_CATEGORIES)[number];

export interface SignatureCapabilityDefinition {
  id: string;
  /** Versión del contrato de la capability — literal `1` (v1), igual que `ComponentDefinition.version` en `blocks.ts`. */
  version: 1;
  name: string;
  category: SignatureCapabilityCategory;
  /** Propósito de negocio de la capability, en español — qué problema real resuelve para el cliente. */
  purpose: string;
  /**
   * Criterios de aceptación concretos y verificables (≥3) — espejo de los
   * tests de la implementación client (T3/T4): cada uno describe un
   * comportamiento observable, no una intención vaga (p.ej. "la columna
   * destacada muestra la insignia textual 'Recomendado', no solo color").
   */
  acceptanceCriteria: string[];
  /**
   * `"certified"`: forma parte de `CAPABILITY_IDS`, la IA puede proponerla.
   * `"candidate"`: existe en el type para futuras entradas — v1 no tiene
   * ninguna `candidate` (las 4 certificadas cubren las 4 categorías v1).
   */
  certification: "certified" | "candidate";
  /**
   * Siempre `false` en v1: interactividad + motion sobre el mismo nodo
   * reproduce la clase de deadlock de `useInView` de F6B (ver D1) —
   * `validatePageTree` la lee para rechazar choreography sobre capability
   * nodes.
   */
  allowsChoreography: false;
  /** Forma v1 de las props que la capability acepta — crece de forma aditiva (ver D4); T3/T4 implementan el render real. */
  propsSchema: z.ZodTypeAny;
  /** Qué datos del proyecto necesita esta capability para funcionar (español, para el prompt IA). */
  dataRequirements: string[];
  /** Industrias típicas de clientes PIXELTEC donde esta capability aplica. */
  supportedIndustries: string[];
  interactionModel: string;
  /** `BlockId` real (`blocks.ts`) que el árbol usa cuando la capability no puede montarse (D2). */
  fallbackComponentId: BlockId;
  accessibilityRequirements: string[];
  performanceCost: "low" | "medium" | "high";
}

/**
 * 4 entradas certificadas v1 — una por categoría certificada. Contenido
 * pensado para clientes típicos de PIXELTEC.MX (agencia mexicana): servicios
 * locales, e-commerce, industrial.
 */
export const SIGNATURE_CAPABILITIES: readonly SignatureCapabilityDefinition[] = [
  {
    id: "coverage-map-v1",
    version: 1,
    name: "Mapa de cobertura de zonas de servicio",
    category: "coverage-map",
    purpose:
      "Que un visitante potencial confirme al instante si su domicilio está dentro del área de servicio, sin tener que llamar a preguntar.",
    acceptanceCriteria: [
      "La lista textual de zonas es la fuente de verdad accesible; el SVG decorativo lleva aria-hidden y no es la única forma de acceder a la información.",
      "Si buscadorPorCP es true y alguna zona trae codigosPostales, el buscador hace match exacto (5 dígitos) o por prefijo (item con menos de 5 dígitos) y resalta la zona encontrada con un chip, anunciándolo por aria-live.",
      "Si el CP buscado no hace match con ninguna zona, se muestra mensajeFueraDeCobertura (o un mensaje por defecto) sin ocultar el resto de las zonas.",
      "Si ninguna zona trae codigosPostales, el buscador de CP no se renderiza en vez de mostrarse siempre vacío.",
    ],
    certification: "certified",
    allowsChoreography: false,
    propsSchema: z.object({
      zonas: z
        .array(
          z.object({
            nombre: z.string().min(1),
            poligonoOrRadio: z.string().min(1),
            codigosPostales: z.array(z.string().min(1)).optional(),
          })
        )
        .min(1),
      buscadorPorCP: z.boolean().optional(),
      mensajeFueraDeCobertura: z.string().min(1).optional(),
    }),
    dataRequirements: [
      "zonas de servicio (colonias, municipios o radio en km)",
      "polígonos o centro+radio de cada zona",
      "mensaje para colonias fuera de cobertura",
    ],
    supportedIndustries: ["servicios locales (plomería, cerrajería, fumigación)", "instalaciones a domicilio", "distribución/logística de última milla"],
    interactionModel:
      "El visitante busca su colonia o código postal (o explora el mapa) y ve al instante si está dentro del área de cobertura.",
    fallbackComponentId: "feature-grid",
    accessibilityRequirements: [
      "alternativa en lista de texto para lectores de pantalla (el mapa no es la única fuente de la información)",
      "contraste AA en los polígonos/zonas resaltadas",
      "buscador de CP operable por teclado",
    ],
    performanceCost: "medium",
  },
  {
    id: "comparison-table-v1",
    version: 1,
    name: "Tabla comparativa de planes o competidores",
    category: "comparison",
    purpose:
      "Que un visitante compare planes o frente a la competencia y entienda de un vistazo por qué la opción propia conviene más, sin depender de percibir un color.",
    acceptanceCriteria: [
      "La tabla usa elementos <table>/<caption>/<th scope> semánticos, no divs con estilos de tabla.",
      "La columna destacada muestra la insignia textual 'Recomendado', no solo color.",
      "Cada th de columna trae un botón de resaltar con aria-pressed operable por teclado (Enter/Espacio), sin depender de hover.",
      "En viewport móvil la tabla se desplaza horizontalmente en un contenedor accesible (overflow-x) conservando el th scope=\"row\" de cada fila — una sola tabla semántica, sin duplicar contenido para lectores de pantalla.",
      "Un valor faltante en una celda se muestra como '—', nunca vacío ni undefined.",
    ],
    certification: "certified",
    allowsChoreography: false,
    propsSchema: z.object({
      columnas: z.array(z.object({ nombre: z.string().min(1), destacada: z.boolean().optional() })).min(2),
      filas: z.array(z.object({ etiqueta: z.string().min(1), valores: z.array(z.string()) })).min(1),
    }),
    dataRequirements: [
      "competidores o planes propios a comparar",
      "criterios/atributos de comparación",
      "diferenciadores propios frente a cada competidor o plan",
    ],
    supportedIndustries: ["e-commerce", "servicios profesionales (planes/paquetes)", "SaaS o software a la medida"],
    interactionModel:
      "Tabla responsiva con la columna propia destacada; en móvil la tabla se desplaza horizontalmente conservando los encabezados de fila.",
    fallbackComponentId: "offer-tiers",
    accessibilityRequirements: [
      "tabla con encabezados semánticos (th/scope, no divs con estilos de tabla)",
      "navegable por teclado sin trampas de foco",
      "la columna destacada no depende solo de color para distinguirse",
    ],
    performanceCost: "low",
  },
  {
    id: "product-selector-v1",
    version: 1,
    name: "Selector guiado de catálogo",
    category: "selector",
    purpose:
      "Que un visitante reduzca un catálogo con filtros progresivos hasta encontrar la opción exacta que necesita, sin ayuda humana.",
    acceptanceCriteria: [
      "Cada filtro se presenta como fieldset de radios (valores derivados de los atributos reales de las opciones) más una opción 'Todas'.",
      "La lista de resultados usa role=list y un aria-live=polite anuncia el conteo cada vez que cambia un filtro.",
      "Existe un botón Restablecer que vuelve todos los filtros a 'Todas' y limpia la selección.",
      "Si el resultado filtrado queda vacío, se muestra un estado vacío con la opción de resetear filtros, no una lista en blanco.",
      "Sin filtros configurados (filtros vacío u omitido), se muestra un grid estático de todas las opciones.",
    ],
    certification: "certified",
    allowsChoreography: false,
    propsSchema: z.object({
      opciones: z
        .array(
          z.object({
            id: z.string().min(1),
            nombre: z.string().min(1),
            atributos: z.record(z.string(), z.string()).optional(),
          })
        )
        .min(1),
      filtros: z.array(z.string().min(1)).optional(),
    }),
    dataRequirements: [
      "catálogo de opciones o productos",
      "atributos filtrables de cada opción",
      "precio o rango de precio si aplica",
    ],
    supportedIndustries: ["e-commerce", "industrial (catálogo técnico de refacciones/equipos)", "servicios con paquetes o niveles"],
    interactionModel:
      "Wizard de filtros progresivos: cada respuesta reduce el catálogo hasta llegar a una recomendación final.",
    fallbackComponentId: "feature-grid",
    accessibilityRequirements: [
      "cada filtro operable por teclado (sin depender de drag ni hover)",
      "el estado de selección se anuncia (aria-live) al reducirse el catálogo",
      "foco visible en cada paso del wizard",
    ],
    performanceCost: "medium",
  },
  {
    id: "process-visualizer-v1",
    version: 1,
    name: "Visualizador del proceso del cliente",
    category: "process-visualizer",
    purpose:
      "Que un visitante entienda en segundos las etapas del proceso del cliente (de contacto a entrega) y su duración, sin depender de una animación de scroll.",
    acceptanceCriteria: [
      "El stepper sigue el patrón ARIA tablist/tab/tabpanel con navegación por flechas y aria-selected en el paso activo.",
      "El paso activo marca aria-current='step' y expone un panel de detalle con su descripción.",
      "En SSR (sin JS) todos los pasos se renderizan visibles en orden lineal, no ocultos a la espera de hidratación.",
      "No hay animación ligada al scroll (scroll-driven) en este componente — para eso existe narrative-scroller/el Motion System de F6B, capa separada.",
    ],
    certification: "certified",
    allowsChoreography: false,
    propsSchema: z.object({
      pasos: z
        .array(
          z.object({
            titulo: z.string().min(1),
            descripcion: z.string().min(1),
            duracionEstimada: z.string().optional(),
          })
        )
        .min(2),
    }),
    dataRequirements: [
      "pasos del proceso del cliente (de contacto a entrega)",
      "tiempo estimado por etapa",
      "responsable o entregable de cada paso",
    ],
    supportedIndustries: ["servicios locales (cotización → instalación → garantía)", "industrial (fabricación/instalación por etapas)", "consultoría"],
    interactionModel:
      "Stepper tipo tabs (tablist/tab/tabpanel) navegable con flechas y teclado; cada paso muestra un panel de detalle al seleccionarse, sin animación ligada al scroll.",
    fallbackComponentId: "process-steps",
    accessibilityRequirements: [
      "orden de lectura lineal que no dependa del scroll-driven animation",
      "respeta `prefers-reduced-motion`",
      "cada paso navegable y expandible por teclado",
    ],
    performanceCost: "low",
  },
];

/** SOLO entradas `certification === "certified"` — las `"candidate"` (ninguna en v1) no son elegibles por la IA. */
export const CAPABILITY_IDS = SIGNATURE_CAPABILITIES.filter((capability) => capability.certification === "certified").map(
  (capability) => capability.id
);
export type CapabilityId = (typeof CAPABILITY_IDS)[number];

export function isCertifiedCapabilityId(value: string): value is CapabilityId {
  return (CAPABILITY_IDS as string[]).includes(value);
}

/**
 * Texto en español para inyectar en el prompt de `generate_directions`: qué
 * capabilities certificadas existen, su propósito de negocio y cuándo puede
 * la IA proponerlas en vez de `custom-development-required`.
 * `acceptanceCriteria` NO se inyecta aquí — son espejo de tests, no material
 * de prompt.
 */
export function getCapabilitiesForPrompt(): string {
  return SIGNATURE_CAPABILITIES.filter((capability) => capability.certification === "certified")
    .map((capability) => {
      const datos = capability.dataRequirements.join("; ");
      return `- ${capability.id} — ${capability.name} (categoría: ${capability.category}). Propósito: ${capability.purpose}. Datos requeridos: ${datos}. Interacción: ${capability.interactionModel}`;
    })
    .join("\n");
}
