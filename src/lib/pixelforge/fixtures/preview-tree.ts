/**
 * Fixture de preview (F6A-T6/T7): un `PageTree` serializado y VÁLIDO que ejerce
 * los 12 blocks del registry para dogfoodear el pipeline de render antes de que
 * F7 introduzca `page_versions` reales. La page de preview lo pasa por
 * `validatePageTree` en runtime — si no valida, la page lanza (dogfooding).
 *
 * Propiedades que este fixture garantiza (cubiertas por `preview-tree.test.ts`):
 *  - Usa LOS 12 `BlockId` del catálogo, uno por nodo, `orden` 1..12 únicos.
 *  - ≥1 variante NO-default (hero-split `media-left`, offer-tiers `table`,
 *    faq-accordion `two-column`, cta-banner `gradient`, etc.).
 *  - Exactamente 2 nodos con coreografía `intensity: 3` (cinematográfica),
 *    ambos sobre blocks con `allowsCinematic: true` (hero-split y cta-banner)
 *    — dentro del máximo de 3 que exige `validatePageTree`.
 *  - `targetSlot` de cada sequence ∈ `editableSlots` del block.
 *
 * NOTA `behaviorId` (deferral EXPLÍCITO): el registry de behaviors de motion
 * llega en F6B. Hoy no hay contra qué validar `behaviorId`, así que se usa el
 * placeholder `"fade-rise"` — `validatePageTree` lo acepta pero emite un WARNING
 * documentado ("behaviors registry llega en F6B") por cada sequence, NUNCA un
 * error. La coreografía se valida estructuralmente pero F6A no la interpreta
 * (PageRenderer es estático; framer-motion/reduced-motion llegan en F6B).
 */
import type { PageTree } from "@/lib/pixelforge/schemas/compose-page-tree";
import type { DesignTokens } from "@/components/pixelforge/render/tokens";

/** Placeholder de behavior hasta que F6B registre los behaviors reales. */
const BEHAVIOR_PLACEHOLDER = "fade-rise";

export const PREVIEW_FIXTURE_TREE: PageTree = {
  notas:
    "Fixture de preview F6A — ejerce los 12 blocks del registry con variantes " +
    "mixtas y 2 nodos cinematográficos. No representa una landing real de cliente.",
  nodes: [
    {
      nodeId: "n1-hero",
      componentId: "hero-split",
      variant: "media-left", // no-default (default: media-right)
      orden: 1,
      propsJson: JSON.stringify({
        titulo: "Automatiza tu operación sin perder el control",
        subtitulo:
          "PixelTEC construye ecosistemas digitales a la medida: menos trabajo manual, más rentabilidad.",
        cta: { label: "Agenda una demo", href: "#contacto" },
        mediaAlt: "Tablero de control de PixelTEC en una laptop",
        badges: ["ISO 27001", "+120 proyectos", "Soporte 24/7"],
      }),
      choreography: {
        narrativePurpose: "Abrir con una entrada cinematográfica que ancle la promesa de valor.",
        motifConnection: "El título asciende como una compuerta que se abre — el motif de 'apertura precisa'.",
        reducedMotionFallback: "El título aparece sin desplazamiento, con un fundido corto.",
        sequences: [
          {
            behaviorId: BEHAVIOR_PLACEHOLDER,
            targetSlot: "titulo",
            trigger: "load",
            order: 0,
            durationToken: "normal",
            delayStrategy: "none",
            intensity: 3, // cinematográfica — hero-split permite allowsCinematic
          },
        ],
      },
    },
    {
      nodeId: "n2-proof",
      componentId: "proof-logos",
      variant: "grid", // no-default (default: row)
      orden: 2,
      propsJson: JSON.stringify({
        titulo: "Empresas que ya operan con nosotros",
        logos: [
          { nombre: "Acme Retail" },
          { nombre: "Nova Logística" },
          { nombre: "Grupo Marea" },
          { nombre: "Talleres Vega" },
        ],
      }),
    },
    {
      nodeId: "n3-features",
      componentId: "feature-grid",
      variant: "3-col",
      orden: 3,
      propsJson: JSON.stringify({
        titulo: "Todo lo que necesitas en un solo lugar",
        features: [
          { titulo: "Integraciones", texto: "Conecta tus herramientas actuales sin fricción.", icono: "plug" },
          { titulo: "Automatización", texto: "Elimina tareas repetitivas con flujos a la medida.", icono: "bolt" },
          { titulo: "Reportes", texto: "Decisiones con datos en tiempo real, no en hojas de cálculo." },
        ],
      }),
    },
    {
      nodeId: "n4-stats",
      componentId: "stats-band",
      variant: "default",
      orden: 4,
      propsJson: JSON.stringify({
        stats: [
          { valor: "120+", etiqueta: "Proyectos entregados" },
          { valor: "98%", etiqueta: "Retención de clientes" },
          { valor: "8 años", etiqueta: "En el mercado" },
        ],
      }),
    },
    {
      nodeId: "n5-narrative",
      componentId: "narrative-scroller",
      variant: "default",
      orden: 5,
      propsJson: JSON.stringify({
        pasos: [
          { titulo: "Diagnóstico", texto: "Mapeamos tu operación y detectamos los cuellos de botella." },
          { titulo: "Diseño", texto: "Definimos el ecosistema digital que resuelve el problema real." },
          { titulo: "Implementación", texto: "Construimos, integramos y capacitamos a tu equipo." },
        ],
      }),
    },
    {
      nodeId: "n6-process",
      componentId: "process-steps",
      variant: "vertical", // no-default (default: horizontal)
      orden: 6,
      propsJson: JSON.stringify({
        titulo: "Cómo trabajamos",
        pasos: [
          { numero: 1, titulo: "Descubrimiento", texto: "Entendemos tus metas y restricciones." },
          { numero: 2, titulo: "Construcción", texto: "Iteramos en sprints con entregas visibles." },
          { numero: 3, titulo: "Lanzamiento", texto: "Ponemos en marcha con soporte cercano." },
        ],
      }),
    },
    {
      nodeId: "n7-offer",
      componentId: "offer-tiers",
      variant: "table", // no-default (default: cards)
      orden: 7,
      propsJson: JSON.stringify({
        titulo: "Planes que crecen contigo",
        tiers: [
          {
            nombre: "Arranque",
            precio: "$15,000",
            periodo: "único",
            bullets: ["Sitio a medida", "Panel básico", "Soporte por correo"],
            ctaLabel: "Empezar",
          },
          {
            nombre: "Crecimiento",
            precio: "$8,000",
            periodo: "mensual",
            bullets: ["Automatizaciones", "Integraciones", "Soporte prioritario"],
            destacado: true,
            ctaLabel: "Elegir Crecimiento",
          },
        ],
      }),
    },
    {
      nodeId: "n8-testimonial",
      componentId: "testimonial-quote",
      variant: "single",
      orden: 8,
      propsJson: JSON.stringify({
        quotes: [
          {
            texto: "Automatizamos el 70% de nuestros procesos en tres meses. El equipo de PixelTEC entendió el negocio, no solo el software.",
            autor: "María Fernanda López",
            cargo: "Directora de Operaciones, Nova Logística",
          },
        ],
      }),
    },
    {
      nodeId: "n9-faq",
      componentId: "faq-accordion",
      variant: "two-column", // no-default (default: single)
      orden: 9,
      propsJson: JSON.stringify({
        titulo: "Preguntas frecuentes",
        items: [
          { pregunta: "¿Cuánto tarda un proyecto?", respuesta: "Entre 4 y 12 semanas según el alcance." },
          { pregunta: "¿Ofrecen mantenimiento?", respuesta: "Sí, con planes mensuales de soporte y evolución." },
          { pregunta: "¿Trabajan con mis sistemas actuales?", respuesta: "Nos integramos con tus herramientas existentes." },
        ],
      }),
    },
    {
      nodeId: "n10-hero-editorial",
      componentId: "hero-editorial",
      variant: "centered",
      orden: 10,
      propsJson: JSON.stringify({
        titulo: "Tecnología con propósito",
        kicker: "Nuestra filosofía",
        parrafo: "No vendemos software: construimos ventajas operativas que se sostienen en el tiempo.",
        cta: { label: "Conoce el método", href: "#metodo" },
      }),
    },
    {
      nodeId: "n11-cta",
      componentId: "cta-banner",
      variant: "gradient", // no-default (default: solid)
      orden: 11,
      propsJson: JSON.stringify({
        titulo: "¿Listo para transformar tu operación?",
        subtitulo: "Agenda una llamada de 30 minutos, sin compromiso.",
        cta: { label: "Hablar con un experto", href: "#contacto" },
      }),
      choreography: {
        narrativePurpose: "Cerrar con un llamado a la acción que retiene la energía del scroll.",
        motifConnection: "El banner se ilumina de borde a centro — el mismo gesto de 'apertura' del hero, cerrando el arco.",
        reducedMotionFallback: "El banner aparece con su color final, sin barrido.",
        sequences: [
          {
            behaviorId: BEHAVIOR_PLACEHOLDER,
            targetSlot: "titulo",
            trigger: "in-view",
            order: 0,
            durationToken: "slow",
            delayStrategy: "semantic",
            intensity: 3, // cinematográfica — cta-banner permite allowsCinematic
          },
        ],
      },
    },
    {
      nodeId: "n12-footer",
      componentId: "footer-contact",
      variant: "default",
      orden: 12,
      propsJson: JSON.stringify({
        empresa: "PixelTEC",
        telefono: "+52 322 000 0000",
        email: "hola@pixeltec.mx",
        direccion: "Puerto Vallarta, Jalisco, México",
        links: [
          { label: "Aviso de privacidad", href: "/aviso-de-privacidad" },
          { label: "Términos", href: "/terminos-de-servicio" },
        ],
      }),
    },
  ],
};

/**
 * Paleta/tokens neutros de PixelTEC — se usan cuando el proyecto todavía no
 * tiene una dirección creativa elegida (`chosenDirectionId` nulo). Asume paleta
 * CLARA, alineada con los fallbacks de `directionTokensToCssVars`.
 */
export const DEFAULT_PREVIEW_TOKENS: DesignTokens = {
  paleta: [
    { token: "color-fondo", valor: "#ffffff", uso: "Fondo base de la landing." },
    { token: "color-texto", valor: "#0f172a", uso: "Texto principal del cuerpo." },
    { token: "color-primario", valor: "#0ea5e9", uso: "Color de marca para CTAs y acentos primarios." },
    { token: "color-acento", valor: "#6366f1", uso: "Acento secundario para detalles y realces." },
    { token: "color-muted", valor: "#64748b", uso: "Texto secundario, bordes y elementos tenues." },
  ],
  tipografia: {
    display: "Poppins",
    body: "Roboto",
    escala: "modular 1.25, base 16px",
  },
  radios: "suaves",
  espaciado: "equilibrado",
  sombra: "sutil",
};
