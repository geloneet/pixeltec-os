/**
 * Block Registry v1 — metadata pura + Zod v3 (server-safe, sin React, sin
 * "use client"). Éste es el corazón de "la IA nunca genera código": la IA
 * solo puede elegir un `id` + `variant` de este catálogo y rellenar props
 * tipadas — nunca aporta HTML/JS crudo. `validatePageTree` (F6A-T4) es la
 * ÚNICA puerta entre el JSON que produce `compose_page_tree` y el árbol que
 * de verdad se renderiza: valida cada nodo contra `getBlockDefinition(id)`,
 * `def.variants`, `def.propsSchema`, `def.editableSlots` y
 * `def.allowsCinematic` — esas firmas son el contrato con T4, no se tocan
 * sin coordinar. T5-T6 usan `BlockId` como key de su `RENDER_MAP` (id ->
 * componente React real) y F7 inyecta `getCatalogForPrompt()` en el prompt
 * de `compose_page_tree`.
 *
 * Nota de versión de Zod: igual que `capabilities.ts`, este archivo vive
 * FUERA de `src/lib/pixelforge/schemas/` así que usa `"zod"` clásico (v3) —
 * `zod/v4` está reservado a `schemas/` y `KIND_SCHEMAS` (ver docstring de
 * `schemas/index.ts`).
 */
import { z } from "zod";

/**
 * Regla de href compartida por TODOS los campos href de TODOS los blocks:
 * solo rutas internas (`/...`), anclas (`#...`) o `https://...` externo —
 * NUNCA `javascript:` ni ningún otro esquema (mailto:, data:, vbscript:,
 * etc.). Es el único punto de la validación de hrefs — cualquier campo href
 * nuevo debe reusar esta misma constante, no reimplementar la regla.
 *
 * Nota (QA-TE-005): el `#` sigue siendo RENDER-safe aquí (las page_versions
 * ya almacenadas con anclas deben seguir renderizando, como link inerte que
 * QA señala), pero el COMPOSER ya no lo acepta ni lo propone — la
 * prohibición vive en `checkComposerRules` (`schemas/compose-page-tree.ts`)
 * y en su SYSTEM_PROMPT. Navegación interna real = capacidad futura con
 * contrato explícito de ids renderer↔composer.
 *
 * `value.startsWith("/")` NO basta para "ruta interna": `"//evil.com"` y
 * `"/\evil.com"` también empiezan con `/`, y el navegador los resuelve como
 * URLs PROTOCOL-RELATIVE (`//evil.com` → `https://evil.com`, y `\` se
 * normaliza a `/` en el parser de URLs de los navegadores, así que
 * `/\evil.com` también termina siendo `//evil.com`). Una ruta interna real
 * nunca tiene `/` o `\` como segundo carácter.
 *
 * Exportada de forma ADITIVA (PF-F8 T2, QA): QA-TE-009 la reusa como defensa
 * en profundidad sobre los `href` de un árbol YA validado — nunca
 * reimplementa la regla.
 */
export function isSafeHref(value: string): boolean {
  if (value.startsWith("/")) {
    const second = value[1];
    return second !== "/" && second !== "\\";
  }
  return value.startsWith("#") || value.startsWith("https://");
}

const hrefSchema = z.string().min(1).refine(isSafeHref, {
  message: 'href inseguro: debe iniciar con "/", "#" o "https://" (nunca "javascript:" ni otro esquema).',
});

/** `{ label, href }` — el shape de CTA que reusan varios blocks. */
const ctaSchema = z
  .object({
    label: z.string().min(1),
    href: hrefSchema,
  })
  .strict();

export interface ComponentDefinition {
  id: string;
  version: 1;
  name: string;
  description: string;
  /** Intenciones de negocio que este block cubre — usadas por compose_page_tree para elegir bloques. */
  intents: string[];
  /** Variantes visuales soportadas — la primera es la variante por defecto. */
  variants: readonly string[];
  /** Validación estricta de props — la ÚNICA barrera entre el JSON de la IA y el componente React real. */
  propsSchema: z.ZodTypeAny;
  /** Tipos de motion que este block puede coreografiar (F6B las implementa). */
  motionIntents: string[];
  /** Si `true`, este block puede participar en la coreografía cinematográfica del Signature Motif. */
  allowsCinematic: boolean;
  /** Nombres de los campos de texto principales — slots que un `targetSlot` de choreography puede referenciar. */
  editableSlots: string[];
  /** Guía en español para la IA sobre cuándo elegir este block. */
  aiHints: string;
}

export const PIXELFORGE_BLOCKS: readonly ComponentDefinition[] = [
  {
    id: "hero-split",
    version: 1,
    name: "Hero dividido con media",
    description: "Hero de apertura con texto a un lado e imagen/video al otro, CTA principal y badges de confianza.",
    intents: ["apertura", "captacion", "primera-impresion"],
    variants: ["media-right", "media-left"],
    propsSchema: z
      .object({
        titulo: z.string().min(1),
        subtitulo: z.string().min(1),
        cta: ctaSchema,
        mediaAlt: z.string().min(1),
        badges: z.array(z.string().min(1)).max(3),
      })
      .strict(),
    motionIntents: ["fade-up", "media-reveal", "stagger-badges"],
    allowsCinematic: true,
    editableSlots: ["titulo", "subtitulo", "cta.label", "mediaAlt", "badges"],
    aiHints:
      "Úsalo como primer bloque de la landing cuando hay una imagen/video fuerte (producto, equipo, instalación) que refuerza la propuesta de valor.",
  },
  {
    id: "hero-editorial",
    version: 1,
    name: "Hero editorial de texto",
    description: "Hero de apertura centrado en tipografía grande, sin media obligatoria — para marcas con voz fuerte.",
    intents: ["apertura", "captacion", "posicionamiento"],
    variants: ["centered", "offset"],
    propsSchema: z
      .object({
        titulo: z.string().min(1),
        kicker: z.string().min(1),
        parrafo: z.string().min(1),
        cta: ctaSchema,
      })
      .strict(),
    motionIntents: ["fade-up", "kicker-reveal"],
    allowsCinematic: true,
    editableSlots: ["titulo", "kicker", "parrafo", "cta.label"],
    aiHints:
      "Úsalo cuando la dirección creativa es editorial/minimalista y no hay una imagen hero clara, o cuando el copy debe ser el protagonista.",
  },
  {
    id: "proof-logos",
    version: 1,
    name: "Barra de prueba social (logos)",
    description: "Franja de logos de clientes o marcas asociadas para reforzar credibilidad.",
    intents: ["prueba-social", "credibilidad"],
    variants: ["row", "grid"],
    propsSchema: z
      .object({
        titulo: z.string().min(1).optional(),
        logos: z
          .array(z.object({ nombre: z.string().min(1) }).strict())
          .min(3)
          .max(8),
      })
      .strict(),
    motionIntents: ["fade-in", "stagger-logos"],
    allowsCinematic: false,
    editableSlots: ["titulo", "logos"],
    aiHints: "Úsalo justo después del hero cuando hay 3-8 marcas/clientes reconocibles que dan credibilidad inmediata.",
  },
  {
    id: "offer-tiers",
    version: 1,
    name: "Planes u ofertas",
    description: "2-3 tarjetas (o tabla) de planes/paquetes con precio, bullets y CTA propios por tier.",
    intents: ["pricing", "conversion", "oferta"],
    variants: ["cards", "table"],
    propsSchema: z
      .object({
        titulo: z.string().min(1),
        tiers: z
          .array(
            z
              .object({
                nombre: z.string().min(1),
                precio: z.string().min(1),
                periodo: z.string().min(1).optional(),
                bullets: z.array(z.string().min(1)).min(1).max(6),
                destacado: z.boolean().optional(),
                ctaLabel: z.string().min(1),
              })
              .strict()
          )
          .min(2)
          .max(3),
      })
      .strict(),
    motionIntents: ["fade-up", "stagger-tiers"],
    allowsCinematic: false,
    editableSlots: ["titulo", "tiers"],
    aiHints: "Úsalo cuando el negocio vende paquetes/planes claros con precio (2-3 opciones) en vez de un servicio único.",
  },
  {
    id: "narrative-scroller",
    version: 1,
    name: "Narrativa por scroll",
    description: "Secuencia de 3-6 pasos que se revelan conforme el usuario hace scroll — para contar una historia paso a paso.",
    intents: ["storytelling", "explicacion"],
    variants: ["default"],
    propsSchema: z
      .object({
        pasos: z
          .array(z.object({ titulo: z.string().min(1), texto: z.string().min(1) }).strict())
          .min(3)
          .max(6),
      })
      .strict(),
    motionIntents: ["scroll-progress", "step-reveal"],
    allowsCinematic: true,
    editableSlots: ["pasos"],
    aiHints:
      "Úsalo cuando el Signature Motif de la dirección elegida pide una narrativa cinematográfica ligada al scroll (no un simple listado de pasos estático — para eso existe process-steps).",
  },
  {
    id: "faq-accordion",
    version: 1,
    name: "Preguntas frecuentes",
    description: "Acordeón de 3-8 preguntas y respuestas para resolver objeciones antes de la conversión.",
    intents: ["objeciones", "confianza", "faq"],
    variants: ["single", "two-column"],
    propsSchema: z
      .object({
        titulo: z.string().min(1),
        items: z
          .array(z.object({ pregunta: z.string().min(1), respuesta: z.string().min(1) }).strict())
          .min(3)
          .max(8),
      })
      .strict(),
    motionIntents: ["fade-in"],
    allowsCinematic: false,
    editableSlots: ["titulo", "items"],
    aiHints: "Úsalo cerca del final de la landing cuando el negocio tiene objeciones recurrentes (precio, tiempos, cobertura, garantía).",
  },
  {
    id: "testimonial-quote",
    version: 1,
    name: "Testimonios",
    description: "1-3 citas de clientes reales con autor y cargo — prueba social cualitativa.",
    intents: ["prueba-social", "confianza"],
    variants: ["single", "carousel-static"],
    propsSchema: z
      .object({
        quotes: z
          .array(
            z
              .object({
                texto: z.string().min(1),
                autor: z.string().min(1),
                cargo: z.string().min(1).optional(),
              })
              .strict()
          )
          .min(1)
          .max(3),
      })
      .strict(),
    motionIntents: ["fade-in", "quote-swap"],
    allowsCinematic: false,
    editableSlots: ["quotes"],
    aiHints: "Úsalo cuando hay 1-3 testimonios reales de clientes disponibles — nunca inventar citas falsas.",
  },
  {
    id: "cta-banner",
    version: 1,
    name: "Banner de llamado a la acción",
    description: "Franja de conversión final o intermedia: título, subtítulo opcional y un CTA prominente.",
    intents: ["conversion", "cierre"],
    variants: ["solid", "gradient"],
    propsSchema: z
      .object({
        titulo: z.string().min(1),
        subtitulo: z.string().min(1).optional(),
        cta: ctaSchema,
      })
      .strict(),
    motionIntents: ["fade-up", "pulse-cta"],
    allowsCinematic: true,
    editableSlots: ["titulo", "subtitulo", "cta.label"],
    aiHints: "Úsalo como cierre de la landing (siempre) y opcionalmente a la mitad si la landing es larga, para no perder al visitante antes del footer.",
  },
  {
    id: "feature-grid",
    version: 1,
    name: "Grid de características",
    description: "3-6 características/beneficios del producto o servicio en formato de tarjetas.",
    intents: ["beneficios", "explicacion"],
    variants: ["3-col", "2-col"],
    propsSchema: z
      .object({
        titulo: z.string().min(1),
        features: z
          .array(
            z
              .object({
                titulo: z.string().min(1),
                texto: z.string().min(1),
                icono: z.string().min(1).optional(),
              })
              .strict()
          )
          .min(3)
          .max(6),
      })
      .strict(),
    motionIntents: ["fade-up", "stagger-features"],
    allowsCinematic: false,
    editableSlots: ["titulo", "features"],
    aiHints: "Úsalo para desglosar 3-6 beneficios o características concretas del producto/servicio.",
  },
  {
    id: "process-steps",
    version: 1,
    name: "Pasos del proceso",
    description: "3-5 pasos numerados y estáticos del proceso del cliente (sin animación ligada al scroll).",
    intents: ["proceso", "explicacion", "confianza"],
    variants: ["horizontal", "vertical"],
    propsSchema: z
      .object({
        titulo: z.string().min(1),
        pasos: z
          .array(
            z
              .object({
                numero: z.number().int().min(1),
                titulo: z.string().min(1),
                texto: z.string().min(1),
              })
              .strict()
          )
          .min(3)
          .max(5),
      })
      .strict(),
    motionIntents: ["fade-up", "stagger-steps"],
    allowsCinematic: false,
    editableSlots: ["titulo", "pasos"],
    aiHints: "Úsalo cuando el proceso del negocio debe verse como lista numerada estática — para una narrativa cinematográfica usa narrative-scroller.",
  },
  {
    id: "stats-band",
    version: 1,
    name: "Franja de métricas",
    description: "2-4 cifras destacadas (clientes atendidos, años de experiencia, satisfacción, etc.).",
    intents: ["prueba-social", "credibilidad", "metricas"],
    variants: ["default"],
    propsSchema: z
      .object({
        stats: z
          .array(z.object({ valor: z.string().min(1), etiqueta: z.string().min(1) }).strict())
          .min(2)
          .max(4),
      })
      .strict(),
    motionIntents: ["count-up", "fade-in"],
    allowsCinematic: false,
    editableSlots: ["stats"],
    aiHints: "Úsalo cuando el negocio tiene 2-4 cifras reales y verificables que refuercen credibilidad — nunca inventar números.",
  },
  {
    id: "footer-contact",
    version: 1,
    name: "Footer con contacto",
    description: "Pie de página con datos de la empresa, contacto y hasta 6 links legales/secundarios.",
    intents: ["cierre", "contacto", "legal"],
    variants: ["default"],
    propsSchema: z
      .object({
        empresa: z.string().min(1),
        telefono: z.string().min(1).optional(),
        email: z.string().min(1).email().optional(),
        direccion: z.string().min(1).optional(),
        links: z.array(z.object({ label: z.string().min(1), href: hrefSchema }).strict()).max(6),
      })
      .strict(),
    motionIntents: ["fade-in"],
    allowsCinematic: false,
    editableSlots: ["empresa", "telefono", "email", "direccion", "links"],
    aiHints: "Úsalo siempre como último bloque de la landing.",
  },
] as const;

export const BLOCK_IDS = PIXELFORGE_BLOCKS.map((block) => block.id);
export type BlockId = (typeof BLOCK_IDS)[number];

export function isRegisteredBlockId(value: string): value is BlockId {
  return (BLOCK_IDS as string[]).includes(value);
}

export function getBlockDefinition(id: BlockId): ComponentDefinition {
  const definition = PIXELFORGE_BLOCKS.find((block) => block.id === id);
  if (!definition) {
    throw new Error(`Block no registrado en PIXELFORGE_BLOCKS: "${id}"`);
  }
  return definition;
}

/** Baja un ZodOptional a su tipo interno — para resumir la forma "real" del campo. */
function unwrapOptional(schema: z.ZodTypeAny): z.ZodTypeAny {
  return schema instanceof z.ZodOptional ? unwrapOptional(schema.unwrap()) : schema;
}

/**
 * Resumen compacto y legible de un `propsSchema` (p.ej. `{titulo:string,cta:{label:string,href:string}}`)
 * — SOLO para `getCatalogForPrompt`, no es un JSON Schema formal. Cubre los
 * tipos zod v3 que de hecho usan los 12 blocks (object/array/string/number/boolean).
 */
function summarizePropsShape(schema: z.ZodTypeAny): string {
  const inner = unwrapOptional(schema);
  if (inner instanceof z.ZodObject) {
    const shape = inner.shape as Record<string, z.ZodTypeAny>;
    const fields = Object.entries(shape).map(([key, value]) => {
      const optional = value instanceof z.ZodOptional;
      return `${key}${optional ? "?" : ""}:${summarizePropsShape(value)}`;
    });
    return `{${fields.join(",")}}`;
  }
  if (inner instanceof z.ZodArray) {
    return `${summarizePropsShape(inner.element)}[]`;
  }
  if (inner instanceof z.ZodString) return "string";
  if (inner instanceof z.ZodNumber) return "number";
  if (inner instanceof z.ZodBoolean) return "boolean";
  return "any";
}

/**
 * Texto en español para inyectar en el prompt de `compose_page_tree` (F7):
 * qué blocks existen, con qué variants/intents, la forma resumida de sus
 * props y sus editableSlots — el único catálogo del que la IA puede elegir.
 */
export function getCatalogForPrompt(): string {
  return PIXELFORGE_BLOCKS.map((block) => {
    const shape = summarizePropsShape(block.propsSchema);
    return `- ${block.id} — ${block.name} (variants: ${block.variants.join("|")}). Intents: ${block.intents.join(
      ", "
    )}. Props: ${shape}. Slots editables: ${block.editableSlots.join(", ")}.`;
  }).join("\n");
}
