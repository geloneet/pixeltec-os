/**
 * Fixture de preview (F6A-T6/T7, coreografía real desde F6B-T3, capabilities
 * desde F6C-T6): un `PageTree` serializado y VÁLIDO que ejerce los 12 blocks
 * del registry MÁS 2 capability nodes certificadas para dogfoodear el
 * pipeline de render antes de que F7 introduzca `page_versions` reales. La
 * page de preview lo pasa por `validatePageTree` en runtime — si no valida,
 * la page lanza (dogfooding).
 *
 * Propiedades que este fixture garantiza (cubiertas por `preview-tree.test.ts`):
 *  - Usa LOS 12 `BlockId` del catálogo, uno por nodo, MÁS 2 capability nodes
 *    (`coverage-map-v1`, `product-selector-v1`) insertados antes del footer,
 *    `orden` 1..14 únicos (F6C-T2: el espacio de `orden` es compartido entre
 *    blocks y capabilities — no exige consecutividad estricta, pero este
 *    fixture la mantiene 1..14 por legibilidad).
 *  - ≥1 variante NO-default (hero-split `media-left`, offer-tiers `table`,
 *    faq-accordion `two-column`, cta-banner `gradient`, etc.).
 *  - Exactamente 3 nodos con coreografía `intensity: 3` (cinematográfica) —
 *    `n1-hero`, `n5-narrative` y `n11-cta`, los tres sobre blocks con
 *    `allowsCinematic: true` — exactamente el máximo que admite
 *    `validatePageTree` (`MAX_CINEMATIC_NODES`), ejercitado a propósito. Los
 *    2 capability nodes NO cuentan para este máximo (D1/D4) y no llevan
 *    `choreography` (prohibida en v1 para capabilities).
 *  - `targetSlot` de cada sequence ∈ `editableSlots` del block.
 *  - `behaviorId` de cada sequence ∈ `BEHAVIOR_IDS` (registry real de
 *    `registry/behaviors.ts`, F6B-T1) — ninguna sequence usa un placeholder:
 *    8 behaviors certificados, se usan 8 de ellos y los 4 `trigger` del
 *    schema (`load`, `in-view`, `scroll-progress`, `interaction`) aparecen al
 *    menos una vez, para ejercitar variedad real en el gate visual.
 *  - `n13-cobertura` (`coverage-map-v1`) y `n14-selector` (`product-selector-v1`)
 *    traen props realistas de un demo instalador solar en Puerto
 *    Vallarta/Bahía de Banderas — sus `propsJson` validan directamente contra
 *    el `propsSchema` real de cada capability en `registry/capabilities.ts`.
 */
import type { PageTree } from "@/lib/pixelforge/schemas/compose-page-tree";
import type { DesignTokens } from "@/components/pixelforge/render/tokens";

export const PREVIEW_FIXTURE_TREE: PageTree = {
  notas:
    "Fixture de preview F6A/F6B — ejerce los 12 blocks del registry con variantes " +
    "mixtas y 3 nodos cinematográficos con behaviors reales. No representa una landing real de cliente.",
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
        narrativePurpose: "Abrir con una entrada cinematográfica que ancle la promesa de valor y presente la media y los badges de confianza en cascada.",
        motifConnection: "El título asciende como una compuerta que se abre — el motif de 'apertura precisa' — y la media y los badges completan la escena con el mismo orden calmado.",
        reducedMotionFallback: "El título aparece sin desplazamiento con un fundido corto, la media aparece directamente en su posición final y los badges se muestran todos a la vez, sin escalonado.",
        sequences: [
          {
            behaviorId: "fade-rise",
            targetSlot: "titulo",
            trigger: "load",
            order: 0,
            durationToken: "normal",
            delayStrategy: "none",
            intensity: 3, // cinematográfica — hero-split permite allowsCinematic
          },
          {
            behaviorId: "media-reveal",
            targetSlot: "mediaAlt",
            trigger: "load",
            order: 1,
            durationToken: "normal",
            delayStrategy: "none",
            intensity: 2,
          },
          {
            behaviorId: "stagger-children",
            targetSlot: "badges",
            trigger: "load",
            order: 2,
            durationToken: "fast",
            delayStrategy: "index",
            intensity: 1,
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
      choreography: {
        narrativePurpose: "Reforzar credibilidad inmediatamente después del hero con la entrada calmada de los logos.",
        motifConnection: "Cascada suave de confianza — continúa el ritmo de apertura sin competir con el hero.",
        reducedMotionFallback: "Los logos aparecen todos a la vez, sin escalonado.",
        sequences: [
          {
            behaviorId: "stagger-children",
            targetSlot: "logos",
            trigger: "in-view",
            order: 0,
            durationToken: "fast",
            delayStrategy: "index",
            intensity: 1,
          },
        ],
      },
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
      choreography: {
        narrativePurpose: "Desglosar los beneficios uno a uno para que cada característica se registre por separado.",
        motifConnection: "Misma cascada escalonada que los logos — construye familiaridad de ritmo antes de las cifras.",
        reducedMotionFallback: "Las tarjetas de características aparecen todas a la vez, sin escalonado.",
        sequences: [
          {
            behaviorId: "stagger-children",
            targetSlot: "features",
            trigger: "in-view",
            order: 0,
            durationToken: "normal",
            delayStrategy: "index",
            intensity: 2,
          },
        ],
      },
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
      choreography: {
        narrativePurpose: "Dar peso a las cifras con un conteo ascendente que las hace sentir verificadas, no decorativas.",
        motifConnection: "El conteo asciende como el título del hero — misma sensación de construcción progresiva.",
        reducedMotionFallback: "Las cifras aparecen directamente con su valor final, sin conteo animado.",
        sequences: [
          {
            behaviorId: "count-up",
            targetSlot: "stats",
            trigger: "in-view",
            order: 0,
            durationToken: "normal",
            delayStrategy: "none",
            intensity: 1,
          },
          {
            behaviorId: "fade-in",
            targetSlot: "stats",
            trigger: "in-view",
            order: 1,
            durationToken: "fast",
            delayStrategy: "none",
            intensity: 1,
          },
        ],
      },
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
      choreography: {
        narrativePurpose: "Contar el método paso a paso ligado al scroll real del usuario, no a un timer — la narrativa cinematográfica del medio de la landing.",
        motifConnection: "Cada paso se revela conforme avanza el scroll, como capítulos de la misma 'apertura precisa' del hero, ahora extendida en el tiempo.",
        reducedMotionFallback: "Los tres pasos aparecen listados en su posición final, sin animación ligada al scroll.",
        sequences: [
          {
            behaviorId: "scroll-reveal-steps",
            targetSlot: "pasos",
            trigger: "scroll-progress",
            order: 0,
            durationToken: "slow",
            delayStrategy: "distance",
            intensity: 3, // cinematográfica — narrative-scroller permite allowsCinematic
          },
        ],
      },
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
        narrativePurpose: "Cerrar con un llamado a la acción que retiene la energía del scroll y el gesto de apertura del hero.",
        motifConnection: "El título se revela con un barrido de borde a centro — el mismo gesto de 'apertura precisa' del hero, cerrando el arco — y el CTA late al interactuar para no perder al visitante.",
        reducedMotionFallback: "El banner aparece con su color y texto final de inmediato, sin barrido ni pulso.",
        sequences: [
          {
            behaviorId: "wipe-reveal",
            targetSlot: "titulo",
            trigger: "in-view",
            order: 0,
            durationToken: "slow",
            delayStrategy: "semantic",
            intensity: 3, // cinematográfica — cta-banner permite allowsCinematic; wipe-reveal exige intensity 3
          },
          {
            behaviorId: "pulse-accent",
            targetSlot: "cta.label",
            trigger: "interaction",
            order: 1,
            durationToken: "normal",
            delayStrategy: "none",
            intensity: 1,
          },
        ],
      },
    },
    {
      nodeId: "n13-cobertura",
      componentId: "coverage-map-v1",
      variant: "default",
      orden: 12,
      propsJson: JSON.stringify({
        zonas: [
          {
            nombre: "Puerto Vallarta",
            poligonoOrRadio: "Zona urbana y costera de Puerto Vallarta, Jalisco",
            codigosPostales: ["48300", "48310", "48333"],
          },
          {
            nombre: "Bahía de Banderas / Nuevo Nayarit",
            poligonoOrRadio: "Municipio de Bahía de Banderas, Nayarit (incluye Nuevo Nayarit)",
            codigosPostales: ["63732", "63735", "637"],
          },
          {
            nombre: "Ixtapa",
            poligonoOrRadio: "Colonia Ixtapa, Puerto Vallarta",
            codigosPostales: ["48280"],
          },
        ],
        buscadorPorCP: true,
        mensajeFueraDeCobertura:
          "Por ahora no instalamos en ese código postal. Escríbenos y te avisamos en cuanto lleguemos a tu zona.",
      }),
    },
    {
      nodeId: "n14-selector",
      componentId: "product-selector-v1",
      variant: "default",
      orden: 13,
      propsJson: JSON.stringify({
        opciones: [
          {
            id: "kit-solar-3kw",
            nombre: "Kit Solar 3kW Residencial",
            atributos: { consumo: "bajo", instalacion: "techo" },
          },
          {
            id: "kit-solar-5kw",
            nombre: "Kit Solar 5kW Residencial",
            atributos: { consumo: "medio", instalacion: "techo" },
          },
          {
            id: "kit-solar-8kw",
            nombre: "Kit Solar 8kW Residencial Plus",
            atributos: { consumo: "alto", instalacion: "techo" },
          },
          {
            id: "kit-solar-10kw-suelo",
            nombre: "Kit Solar 10kW en Suelo",
            atributos: { consumo: "alto", instalacion: "suelo" },
          },
          {
            id: "kit-solar-6kw-suelo",
            nombre: "Kit Solar 6kW en Suelo",
            atributos: { consumo: "medio", instalacion: "suelo" },
          },
        ],
        filtros: ["consumo", "instalacion"],
      }),
    },
    {
      nodeId: "n12-footer",
      componentId: "footer-contact",
      variant: "default",
      orden: 14,
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
