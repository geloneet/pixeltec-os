/**
 * Catálogo de QA (PF-F8) — fuente de verdad ÚNICA de códigos, categorías,
 * clases y severidades de check. T4 (API), T5 (críticas IA) y T6 (runner de
 * navegador) leen de aquí las definiciones de sus checks — nunca hardcodean
 * un código/severidad/blocking en otro lugar del árbol de fuentes.
 *
 * Módulo 100% LÓGICA PURA: sin DB, sin fetch, sin fecha del sistema, sin
 * aleatoriedad. Declara los checks `nav`/`ia` (clase "se ejecuta en T5/T6")
 * igual que los `det`/`heu` que este módulo SÍ ejecuta — el catálogo es un
 * dato compartido, la ejecución no.
 *
 * Nota sobre el conteo "46 checks" del plan maestro: la tabla verbatim del
 * brief enumera 46 códigos de las clases det/nav/heu (`QA-ST-*` a `QA-TE-*`)
 * MÁS 3 códigos `QA-IA-*` (clase `ia`, advisory, peso 0 en el scoring) — un
 * total de 49 entradas en `QA_CHECKS`. `catalog.test.ts` verifica que los 46
 * códigos det/nav/heu del plan están presentes (no que el array mida
 * exactamente 46), y por separado que los 3 códigos IA también lo están.
 */
import type { InsertQaFindingInput } from "@/lib/db/repos/pixelforge";

export const QA_CATALOG_VERSION = "1";

/** Clase de ejecución de un check — quién lo corre y con qué evidencia. */
export type QaCheckClass = "det" | "nav" | "heu" | "ia";

/** Severidad de un hallazgo — igual al enum `pixelforge_qa_severity` (schema.ts). */
export type QaCheckSeverity = "critical" | "major" | "minor" | "info";

/** Las 8 categorías del scoring (`scoring.ts` las pondera). */
export type QaCheckCategory =
  | "estructura"
  | "diseno"
  | "visual"
  | "accesibilidad"
  | "tecnico"
  | "motion"
  | "capacidades"
  | "ia";

/**
 * Entrada del catálogo. `severity`/`blocking` son el valor REPRESENTATIVO/por
 * defecto de la definición — algunos checks computan el valor real por
 * hallazgo (ver notas puntuales abajo, p.ej. QA-DI-002, QA-AX-001, QA-IA-001/002).
 */
export interface QaCheckDefinition {
  code: string;
  category: QaCheckCategory;
  checkClass: QaCheckClass;
  severity: QaCheckSeverity;
  /**
   * `true`: el hallazgo de este check siempre bloquea. `false`: nunca
   * bloquea. `"conditional"`: el check decide el `blocking` real por
   * hallazgo (único caso v1: QA-DI-002, bloquea solo si fg/bg < 3.0).
   */
  blocking: boolean | "conditional";
  title: string;
  recommendation: string;
}

/**
 * Forma de un hallazgo listo para `insertQaFindings` (T1,
 * `src/lib/db/repos/pixelforge.ts`) — alias de tipo puro (se borra en
 * compilación, no arrastra el repo/DB al bundle de `qa/`). Nombre del
 * contrato con T4/T5/T6 (brief F8-T2); el repo lo declaró como
 * `InsertQaFindingInput`, sin drift de forma.
 */
export type QaFindingInput = InsertQaFindingInput;

const CHECK_CODE_FORMAT_RE = /^QA-[A-Z]{2}-\d{3}$/;

/** `true` si `code` respeta el formato `QA-[A-Z]{2}-\d{3}` (p.ej. `QA-ST-001`). */
export function isValidCheckCode(code: string): boolean {
  return CHECK_CODE_FORMAT_RE.test(code);
}

export const QA_CHECKS: readonly QaCheckDefinition[] = [
  // ── Estructura (det) ──────────────────────────────────────────────────────
  {
    code: "QA-ST-001",
    category: "estructura",
    checkClass: "det",
    severity: "critical",
    blocking: true,
    title: "El árbol de la página no valida contra el registry",
    recommendation: "Corrige el árbol para que pase validatePageTree antes de continuar — cada error debe resolverse en el origen (composer/edición manual).",
  },
  {
    code: "QA-ST-002",
    category: "estructura",
    checkClass: "det",
    severity: "critical",
    blocking: true,
    title: "El árbol no cumple 3-14 nodos con un único footer-contact al final",
    recommendation: "Ajusta el número de nodos (3-14), asegura exactamente un nodo footer-contact y colócalo como el de mayor orden.",
  },
  {
    code: "QA-ST-003",
    category: "estructura",
    checkClass: "det",
    severity: "minor",
    blocking: false,
    title: "El campo orden de los nodos tiene huecos",
    recommendation: "Renumera orden como una secuencia consecutiva 1..n sin saltos.",
  },
  {
    code: "QA-ST-004",
    category: "estructura",
    checkClass: "det",
    severity: "info",
    blocking: false,
    title: "El QA evaluó una versión que ya no es la más reciente",
    recommendation: "Vuelve a correr el QA sobre la versión actual antes de cerrar la estación.",
  },

  // ── Diseño (det, salvo DI-007 nav) ────────────────────────────────────────
  {
    code: "QA-DI-001",
    category: "diseno",
    checkClass: "det",
    severity: "critical",
    blocking: true,
    title: "Colisión de color: primary o fg quedan iguales al bg",
    recommendation: "Revisa la paleta de la dirección elegida — un texto/acento igual al fondo es invisible. Si la paleta es monocolor, elige/ajusta al menos un token adicional distinguible.",
  },
  {
    code: "QA-DI-002",
    category: "diseno",
    checkClass: "det",
    severity: "major",
    blocking: "conditional",
    title: "Contraste WCAG insuficiente en un par de roles semánticos",
    recommendation: "Ajusta los tokens de color para cumplir 4.5:1 (fg/bg, on-primary/primary) o 3:1 (accent/bg, muted/bg).",
  },
  {
    code: "QA-DI-003",
    category: "diseno",
    checkClass: "det",
    severity: "minor",
    blocking: false,
    title: "Un token de paleta se descartó por contener valores CSS hostiles",
    recommendation: "Revisa el valor del token en la dirección creativa — probablemente incluye caracteres no válidos en un valor CSS (`;`, `{`, `url(`, etc.).",
  },
  {
    code: "QA-DI-004",
    category: "diseno",
    checkClass: "det",
    severity: "minor",
    blocking: false,
    title: "Un rol semántico (primary/fg/bg) no matcheó ningún token y cayó al fallback",
    recommendation: "Nombra o describe (`uso`) al menos un token de la paleta con palabras clave del rol (p.ej. \"fondo\", \"texto\", \"marca\") para que el rol tome un valor propio de la dirección.",
  },
  {
    code: "QA-DI-005",
    category: "diseno",
    checkClass: "det",
    severity: "minor",
    blocking: false,
    title: "La tipografía display o body degradó a la familia genérica sans-serif",
    recommendation: "Revisa el nombre de familia tipográfica de la dirección — probablemente quedó vacío tras sanear caracteres hostiles.",
  },
  {
    code: "QA-DI-006",
    category: "diseno",
    checkClass: "det",
    severity: "major",
    blocking: false,
    title: "El proyecto no tiene una dirección creativa chosen — el preview usa tokens default",
    recommendation: "Elige una dirección creativa en la estación 'direcciones' antes de avanzar a producción.",
  },
  {
    code: "QA-DI-007",
    category: "diseno",
    checkClass: "nav",
    severity: "minor",
    blocking: false,
    title: "Jerarquía tipográfica inconsistente entre secciones",
    recommendation: "Revisa que los tamaños de encabezado sigan una escala consistente entre secciones (runner de navegador, T6).",
  },

  // ── Visual (nav, salvo VI-008/009 heu) ────────────────────────────────────
  {
    code: "QA-VI-001",
    category: "visual",
    checkClass: "nav",
    severity: "major",
    blocking: false,
    title: "Overflow horizontal del documento",
    recommendation: "Revisa anchos fijos o contenido que no se envuelve (runner de navegador, T6).",
  },
  {
    code: "QA-VI-002",
    category: "visual",
    checkClass: "nav",
    severity: "major",
    blocking: false,
    title: "Overflow horizontal dentro de una sección",
    recommendation: "Revisa el contenido de la sección afectada (runner de navegador, T6).",
  },
  {
    code: "QA-VI-003",
    category: "visual",
    checkClass: "nav",
    severity: "minor",
    blocking: false,
    title: "Texto truncado inesperadamente",
    recommendation: "Revisa longitudes de copy contra el layout en el viewport afectado (runner de navegador, T6).",
  },
  {
    code: "QA-VI-004",
    category: "visual",
    checkClass: "nav",
    severity: "major",
    blocking: false,
    title: "Bounding box de un elemento fuera de tolerancia",
    recommendation: "Revisa el layout del elemento en el viewport afectado (runner de navegador, T6).",
  },
  {
    code: "QA-VI-005",
    category: "visual",
    checkClass: "nav",
    severity: "major",
    blocking: false,
    title: "Imagen rota (no cargó)",
    recommendation: "Verifica la URL/alt de la imagen y que el asset exista (runner de navegador, T6).",
  },
  {
    code: "QA-VI-006",
    category: "visual",
    checkClass: "nav",
    severity: "minor",
    blocking: false,
    title: "Imagen distorsionada (aspect ratio fuera de tolerancia)",
    recommendation: "Revisa el aspect ratio original del asset contra el contenedor (runner de navegador, T6).",
  },
  {
    code: "QA-VI-007",
    category: "visual",
    checkClass: "nav",
    severity: "major",
    blocking: false,
    title: "Sección visualmente colapsada (altura ~0)",
    recommendation: "Revisa que la sección tenga contenido renderizado y estilos aplicados (runner de navegador, T6).",
  },
  {
    code: "QA-VI-008",
    category: "visual",
    checkClass: "heu",
    severity: "minor",
    blocking: false,
    title: "Copy por encima del límite recomendado para su slot",
    recommendation: "Acorta el texto para que quepa cómodamente en el slot (título de hero, label de CTA o párrafo).",
  },
  {
    code: "QA-VI-009",
    category: "visual",
    checkClass: "heu",
    severity: "minor",
    blocking: false,
    title: "Un bloque de lista/grid quedó por debajo del mínimo recomendado de ítems",
    recommendation: "Agrega más ítems al bloque (features, preguntas, logos, tiers, pasos o stats) para que se vea completo.",
  },

  // ── Motion (nav, salvo MO-004/006 heu) ────────────────────────────────────
  {
    code: "QA-MO-001",
    category: "motion",
    checkClass: "nav",
    severity: "critical",
    blocking: true,
    title: "Deadlock de motion (anti-deadlock)",
    recommendation: "Revisa la coreografía del nodo — una animación dependiente de interacción/viewport nunca se resuelve (runner de navegador, T6).",
  },
  {
    code: "QA-MO-002",
    category: "motion",
    checkClass: "nav",
    severity: "major",
    blocking: false,
    title: "prefers-reduced-motion no se respeta",
    recommendation: "Verifica el fallback estático de la choreography (runner de navegador, T6).",
  },
  {
    code: "QA-MO-003",
    category: "motion",
    checkClass: "nav",
    severity: "major",
    blocking: false,
    title: "El conteo ascendente (count-up) no llega al valor exacto",
    recommendation: "Revisa el valor final animado contra el dato fuente (runner de navegador, T6).",
  },
  {
    code: "QA-MO-004",
    category: "motion",
    checkClass: "heu",
    severity: "minor",
    blocking: false,
    title: "Un valor de count-up tiene un formato que el parser puede degradar",
    recommendation: "Usa cifras sin separador de millares (o verifica manualmente el conteo animado) para el valor de esta estadística.",
  },
  {
    code: "QA-MO-005",
    category: "motion",
    checkClass: "nav",
    severity: "major",
    blocking: false,
    title: "Una animación bloquea la interacción del usuario",
    recommendation: "Revisa que el elemento sea operable (click/foco) antes de que termine la animación (runner de navegador, T6).",
  },
  {
    code: "QA-MO-006",
    category: "motion",
    checkClass: "heu",
    severity: "minor",
    blocking: false,
    title: "Secuencia de motion estimada demasiado larga o con demasiados nodos cinematográficos contiguos",
    recommendation: "Reduce la duración/delay de la secuencia o reparte los nodos cinematográficos para que no queden más de 2 consecutivos.",
  },

  // ── Capacidades (heu/nav, salvo CA-005 det) ───────────────────────────────
  {
    code: "QA-CA-001",
    category: "capacidades",
    checkClass: "heu",
    severity: "major",
    blocking: false,
    title: "Una capability tiene datos por debajo del mínimo útil",
    recommendation: "Agrega más datos (columnas, opciones, zonas o pasos) para que la capability aporte valor real al visitante.",
  },
  {
    code: "QA-CA-002",
    category: "capacidades",
    checkClass: "nav",
    severity: "major",
    blocking: false,
    title: "Una capability no degrada correctamente sin JavaScript",
    recommendation: "Verifica el fallback SSR de la capability (runner de navegador, T6).",
  },
  {
    code: "QA-CA-003",
    category: "capacidades",
    checkClass: "nav",
    severity: "major",
    blocking: false,
    title: "La interacción principal de una capability no funciona",
    recommendation: "Verifica el flujo de interacción (filtros, buscador, tabs) de la capability (runner de navegador, T6).",
  },
  {
    code: "QA-CA-004",
    category: "capacidades",
    checkClass: "nav",
    severity: "major",
    blocking: false,
    title: "Una capability no es operable por teclado",
    recommendation: "Verifica foco visible y navegación por teclado de la capability (runner de navegador, T6).",
  },
  {
    code: "QA-CA-005",
    category: "capacidades",
    checkClass: "det",
    severity: "info",
    blocking: false,
    title: "El fallbackComponentId de una capability usada no está registrado",
    recommendation: "Defensa en profundidad — reporta este hallazgo al equipo de plataforma, el registry debería garantizar esto en compilación.",
  },

  // ── Accesibilidad (nav) ───────────────────────────────────────────────────
  {
    code: "QA-AX-001",
    category: "accesibilidad",
    checkClass: "nav",
    severity: "major",
    blocking: false,
    title: "Violación de axe-core",
    recommendation: "Corrige la violación reportada por axe-core (runner de navegador, T6) — severidad real mapeada vía AXE_IMPACT_TO_SEVERITY.",
  },
  {
    code: "QA-AX-002",
    category: "accesibilidad",
    checkClass: "nav",
    severity: "critical",
    blocking: true,
    title: "Trampa de foco de teclado",
    recommendation: "Verifica que el foco de teclado nunca quede atrapado dentro de un componente (runner de navegador, T6).",
  },
  {
    code: "QA-AX-003",
    category: "accesibilidad",
    checkClass: "nav",
    severity: "major",
    blocking: false,
    title: "Foco no visible en un elemento interactivo",
    recommendation: "Verifica el estilo de foco (outline/ring) de los elementos interactivos (runner de navegador, T6).",
  },
  {
    code: "QA-AX-004",
    category: "accesibilidad",
    checkClass: "nav",
    severity: "minor",
    blocking: false,
    title: "Landmarks ARIA faltantes o duplicados",
    recommendation: "Revisa la estructura de landmarks de la página (runner de navegador, T6).",
  },
  {
    code: "QA-AX-005",
    category: "accesibilidad",
    checkClass: "nav",
    severity: "minor",
    blocking: false,
    title: "Salto de nivel de encabezado",
    recommendation: "Revisa que los niveles de heading no salten (p.ej. h2 a h4 directo) (runner de navegador, T6).",
  },
  {
    code: "QA-AX-006",
    category: "accesibilidad",
    checkClass: "nav",
    severity: "major",
    blocking: false,
    title: "Formulario sin label asociado o sin mensaje de error accesible",
    recommendation: "Verifica label/aria-describedby de los campos de formulario (runner de navegador, T6).",
  },

  // ── Técnico (nav, salvo TE-009 heu) ───────────────────────────────────────
  {
    code: "QA-TE-001",
    category: "tecnico",
    checkClass: "nav",
    severity: "major",
    blocking: false,
    title: "Error de JavaScript en runtime (pageerror)",
    recommendation: "Revisa la consola del navegador para el stack trace del error (runner de navegador, T6).",
  },
  {
    code: "QA-TE-002",
    category: "tecnico",
    checkClass: "nav",
    severity: "critical",
    blocking: true,
    title: "Error de hidratación",
    recommendation: "Revisa mismatches de SSR/CSR (runner de navegador, T6).",
  },
  {
    code: "QA-TE-003",
    category: "tecnico",
    checkClass: "nav",
    severity: "major",
    blocking: false,
    title: "Un recurso (imagen/script/estilo) no cargó",
    recommendation: "Revisa las URLs de recursos referenciados por la página (runner de navegador, T6).",
  },
  {
    code: "QA-TE-004",
    category: "tecnico",
    checkClass: "nav",
    severity: "minor",
    blocking: false,
    title: "console.error durante la carga",
    recommendation: "Revisa el mensaje de consola — puede anticipar un bug no fatal (runner de navegador, T6).",
  },
  {
    code: "QA-TE-005",
    category: "tecnico",
    checkClass: "nav",
    severity: "major",
    blocking: false,
    title: "Un link interno apunta a una ruta que no existe",
    recommendation: "Verifica que cada href interno resuelva a una página real (runner de navegador, T6).",
  },
  {
    code: "QA-TE-006",
    category: "tecnico",
    checkClass: "nav",
    severity: "minor",
    blocking: false,
    title: "Presupuesto de performance básico excedido",
    recommendation: "Revisa LCP/tamaño de assets contra el presupuesto (runner de navegador, T6).",
  },
  {
    code: "QA-TE-007",
    category: "tecnico",
    checkClass: "nav",
    severity: "major",
    blocking: false,
    title: "La página no funciona sin JavaScript global",
    recommendation: "Verifica que el contenido esencial se sirva en SSR (runner de navegador, T6).",
  },
  {
    code: "QA-TE-008",
    category: "tecnico",
    checkClass: "nav",
    severity: "info",
    blocking: false,
    title: "Header de Content-Security-Policy ausente o débil",
    recommendation: "Revisa la configuración de CSP del despliegue (runner de navegador, T6).",
  },
  {
    code: "QA-TE-009",
    category: "tecnico",
    checkClass: "heu",
    severity: "critical",
    blocking: true,
    title: "Un href de la página no es seguro (no empieza con /, # o https://)",
    recommendation: "Corrige el href para que apunte a una ruta interna, un ancla o un destino https:// externo — nunca javascript:/data:/otros esquemas.",
  },

  // ── IA advisory (ia, peso 0 en el scoring) ────────────────────────────────
  {
    code: "QA-IA-001",
    category: "ia",
    checkClass: "ia",
    severity: "info",
    blocking: false,
    title: "Crítica de diseño IA (critique_design)",
    recommendation: "Revisa la crítica de diseño generada por IA — es advisory, no bloquea (T5).",
  },
  {
    code: "QA-IA-002",
    category: "ia",
    checkClass: "ia",
    severity: "info",
    blocking: false,
    title: "Score de originalidad IA (score_originality)",
    recommendation: "Revisa el score de originalidad y sus razones — es advisory, no bloquea (T5).",
  },
  {
    code: "QA-IA-003",
    category: "ia",
    checkClass: "ia",
    severity: "info",
    blocking: false,
    title: "Señal de semejanza genérica IA (detect_ai_likeness)",
    recommendation: "Revisa la señal detectada — es advisory, no bloquea (T5).",
  },
] as const;

export function getCheckDefinition(code: string): QaCheckDefinition | undefined {
  return QA_CHECKS.find((check) => check.code === code);
}

// ─── Tolerancias de checks de navegador (T6) — viven aquí para que catalog.ts
// sea la única fuente de constantes numéricas del plan de QA, aunque T2 no
// las consuma directamente. ─────────────────────────────────────────────────

/** QA-VI-001/002 — tolerancia de overflow horizontal, en px. */
export const OVERFLOW_TOLERANCE_PX = 1;
/** QA-VI-003 — tolerancia de truncado/clipping de texto, en px. */
export const CLIPPING_TOLERANCE_PX = 2;
/** QA-VI-004 — tolerancia de bounding box, en px. */
export const BOUNDING_TOLERANCE_PX = 4;
/** QA-VI-006 — tolerancia de distorsión de aspect ratio, como fracción (0.15 = 15%). */
export const ASPECT_RATIO_TOLERANCE = 0.15;
/** QA-MO-002/003/005 — tiempo de asentamiento tras disparar una animación, en ms. */
export const MOTION_SETTLE_MS = 500;
/** QA-TE-006 — presupuesto de Largest Contentful Paint, en ms. */
export const LCP_BUDGET_MS = 4000;
/** QA-TE-006 — presupuesto de peso total de assets de imagen, en bytes (3MB). */
export const IMAGE_ASSET_SIZE_BUDGET_BYTES = 3 * 1024 * 1024;
/** QA-TE-006 — presupuesto de peso de JavaScript, en bytes (800KB). */
export const JS_SIZE_BUDGET_BYTES = 800 * 1024;

// ─── Límites de copy (QA-VI-008) ────────────────────────────────────────────

export const HERO_TITLE_MAX_CHARS = 90;
export const CTA_LABEL_MAX_CHARS = 32;
export const PARAGRAPH_MAX_CHARS = 600;

// ─── Mínimos de ítems por block (QA-VI-009) ─────────────────────────────────

/** Mínimo recomendado de ítems por `componentId` — por debajo de esto el bloque se ve incompleto. */
export const MIN_ITEMS_BY_BLOCK: Readonly<Record<string, number>> = {
  "feature-grid": 2,
  "faq-accordion": 2,
  "proof-logos": 3,
  "offer-tiers": 2,
  "process-steps": 2,
  "stats-band": 2,
};

/** Campo de props que contiene el array de ítems a contar, por `componentId` — mismas keys que `MIN_ITEMS_BY_BLOCK`. */
export const ITEMS_FIELD_BY_BLOCK: Readonly<Record<string, string>> = {
  "feature-grid": "features",
  "faq-accordion": "items",
  "proof-logos": "logos",
  "offer-tiers": "tiers",
  "process-steps": "pasos",
  "stats-band": "stats",
};

// ─── Motion (QA-MO-006) ──────────────────────────────────────────────────────

/** Presupuesto estimado de delay+duration total por sequence antes de considerarla "demasiado larga", en ms. */
export const MOTION_SEQUENCE_BUDGET_MS = 2500;
/** Máximo de nodos cinematográficos (`intensity===3`) consecutivos por `orden` antes de reportar QA-MO-006. */
export const MAX_CONTIGUOUS_CINEMATIC_NODES = 2;

// ─── Accesibilidad (QA-AX-001, T6) ───────────────────────────────────────────

/** Mapeo de `impact` de axe-core a severidad de QA — el runner (T6) lo usa para cada violación reportada. */
export const AXE_IMPACT_TO_SEVERITY: Readonly<Record<"critical" | "serious" | "moderate" | "minor", QaCheckSeverity>> = {
  critical: "major",
  serious: "major",
  moderate: "minor",
  minor: "info",
};

// ─── IA advisory (QA-IA-001/002, T5) ─────────────────────────────────────────

/** Score de rúbrica (0-100) por debajo del cual QA-IA-001/002 se reporta como `minor` en vez de `info`. */
export const IA_RUBRIC_MINOR_THRESHOLD = 60;
