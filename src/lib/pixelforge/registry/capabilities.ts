/**
 * Signature Capability Registry — F5 = SOLO metadata (server-safe, sin React,
 * sin "use client"). El plan maestro exige validar `signatureComponent` de
 * cada dirección creativa "contra Capability Registry (o
 * custom-development-required)": este módulo es esa fuente de verdad.
 *
 * Las implementaciones CLIENT (render real de cada capability, wiring a
 * `blocks`/`behaviors`) son de F6C y NO se tocan aquí — `propsSchema` es
 * deliberadamente v1 mínimo (la forma que hoy se puede prometer), pensado
 * para crecer cuando F6C construya el componente real.
 *
 * Nota de versión de Zod: este archivo vive FUERA de `src/lib/pixelforge/schemas/`
 * (no es un output schema de Structured Outputs), así que usa `"zod"` clásico
 * (v3) — igual que el resto del repo. `zod/v4` está reservado a
 * `src/lib/pixelforge/schemas/` y `KIND_SCHEMAS` (ver docstring de
 * `schemas/index.ts`); no se mezcla aquí.
 */
import { z } from "zod";

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
  name: string;
  category: SignatureCapabilityCategory;
  /** Forma v1 mínima de las props que la capability aceptará — F6C la implementa. */
  propsSchema: z.ZodTypeAny;
  /** Qué datos del proyecto necesita esta capability para funcionar (español, para el prompt IA). */
  dataRequirements: string[];
  /** Industrias típicas de clientes PIXELTEC donde esta capability aplica. */
  supportedIndustries: string[];
  interactionModel: string;
  /** Id de un componente/bloque estático que renderiza algo razonable si la capability no está lista. */
  fallbackComponentId: string;
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
    name: "Mapa de cobertura de zonas de servicio",
    category: "coverage-map",
    propsSchema: z.object({
      zonas: z
        .array(
          z.object({
            nombre: z.string().min(1),
            poligonoOrRadio: z.string().min(1),
          })
        )
        .min(1),
      buscadorPorCP: z.boolean().optional(),
    }),
    dataRequirements: [
      "zonas de servicio (colonias, municipios o radio en km)",
      "polígonos o centro+radio de cada zona",
      "mensaje para colonias fuera de cobertura",
    ],
    supportedIndustries: ["servicios locales (plomería, cerrajería, fumigación)", "instalaciones a domicilio", "distribución/logística de última milla"],
    interactionModel:
      "El visitante busca su colonia o código postal (o explora el mapa) y ve al instante si está dentro del área de cobertura.",
    fallbackComponentId: "coverage-list-static",
    accessibilityRequirements: [
      "alternativa en lista de texto para lectores de pantalla (el mapa no es la única fuente de la información)",
      "contraste AA en los polígonos/zonas resaltadas",
      "buscador de CP operable por teclado",
    ],
    performanceCost: "medium",
  },
  {
    id: "comparison-table-v1",
    name: "Tabla comparativa de planes o competidores",
    category: "comparison",
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
      "Tabla responsiva con la columna propia destacada; en móvil colapsa a tarjetas apilables sin perder los encabezados de fila.",
    fallbackComponentId: "comparison-list-static",
    accessibilityRequirements: [
      "tabla con encabezados semánticos (th/scope, no divs con estilos de tabla)",
      "navegable por teclado sin trampas de foco",
      "la columna destacada no depende solo de color para distinguirse",
    ],
    performanceCost: "low",
  },
  {
    id: "product-selector-v1",
    name: "Selector guiado de catálogo",
    category: "selector",
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
    fallbackComponentId: "selector-grid-static",
    accessibilityRequirements: [
      "cada filtro operable por teclado (sin depender de drag ni hover)",
      "el estado de selección se anuncia (aria-live) al reducirse el catálogo",
      "foco visible en cada paso del wizard",
    ],
    performanceCost: "medium",
  },
  {
    id: "process-visualizer-v1",
    name: "Visualizador del proceso del cliente",
    category: "process-visualizer",
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
      "Línea de tiempo horizontal o vertical con avance ligado al scroll; cada paso se expande para mostrar el detalle.",
    fallbackComponentId: "process-steps-static",
    accessibilityRequirements: [
      "orden de lectura lineal que no dependa del scroll-driven animation",
      "respeta `prefers-reduced-motion`",
      "cada paso navegable y expandible por teclado",
    ],
    performanceCost: "low",
  },
];

export const CAPABILITY_IDS = SIGNATURE_CAPABILITIES.map((capability) => capability.id);
export type CapabilityId = (typeof CAPABILITY_IDS)[number];

export function isCertifiedCapabilityId(value: string): value is CapabilityId {
  return (CAPABILITY_IDS as string[]).includes(value);
}

/**
 * Texto en español para inyectar en el prompt de `generate_directions`: qué
 * capabilities certificadas existen y cuándo puede la IA proponerlas en vez
 * de `custom-development-required`.
 */
export function getCapabilitiesForPrompt(): string {
  return SIGNATURE_CAPABILITIES.map((capability) => {
    const datos = capability.dataRequirements.join("; ");
    return `- ${capability.id} — ${capability.name} (categoría: ${capability.category}). Datos requeridos: ${datos}. Interacción: ${capability.interactionModel}`;
  }).join("\n");
}
