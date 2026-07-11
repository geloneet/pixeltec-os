/**
 * Configuración declarativa de las 4 estaciones del pipeline de Definición.
 *
 * TODO lo que varía entre estaciones vive aquí (persona/prompt, etiquetas,
 * cómo se arma el mensaje de arranque con el contexto upstream). El motor
 * (API route, actions, UI) es genérico e itera sobre esta config — es UNA
 * mecánica reutilizada 4 veces, no 4 desarrollos.
 *
 * El contexto entre estaciones viaja por los SELLOS, no por el historial de
 * chat: cada estación arranca conversación limpia y su `buildKickoffMessage`
 * inyecta los `sealedContent` upstream que necesita. Ver src/lib/definition/
 * types.ts para el orden canónico.
 */
import type { DefinitionStation } from "@/lib/definition/types";
import { STATION_SEQUENCE } from "@/lib/definition/types";

export interface StationContext {
  clientName: string;
  brainDump: string;
  /** sealedContent de estaciones previas, por id de estación. */
  sealed: Partial<Record<DefinitionStation, string>>;
}

export interface StationConfig {
  id: DefinitionStation;
  order: number;
  /** Etiqueta corta para el stepper. */
  stepLabel: string;
  /** Título completo de la estación. */
  title: string;
  /** Nombre del entregable y H1 del documento (contrato de salida). */
  sealName: string;
  /** Texto del botón de aprobación. */
  approveLabel: string;
  /** true si el sello es uno de los 3 documentos descargables finales. */
  deliverable: boolean;
  /** Slug de export (solo estaciones deliverable). */
  exportSlug?: "origen" | "mvp" | "flujo";
  /** Descripción de una línea para la UI. */
  hint: string;
  systemPrompt: string;
  buildKickoffMessage: (ctx: StationContext) => string;
}

// ── Persona compartida ──────────────────────────────────────────────────────

const PM_PERSONA = `Eres un Product Manager senior y RETADOR de PixelTEC, una agencia de software mexicana. Tu trabajo es ayudar a aterrizar la idea de un proyecto para un cliente.

Tu estilo:
- Directo, profesional y en español mexicano neutro.
- CUESTIONAS supuestos, señalas ambigüedades, riesgos y huecos — pero NUNCA te quedas solo en preguntas: SIEMPRE entregas una propuesta concreta y accionable, tomando decisiones razonables donde falte información y marcándolas como supuestos.
- No inflas alcance ni prometes de más. Piensas en lo que de verdad mueve la aguja.

CONTRATO DE SALIDA (obligatorio):
- Responde ÚNICAMENTE con el documento en formato Markdown. Nada de saludos, preámbulos ni despedidas: tu respuesta ES el entregable.
- El documento SIEMPRE empieza con el encabezado H1 que se te indique en cada estación.
- Si tienes retos, dudas o decisiones que el usuario debería confirmar, ponlos al final dentro de una sección "## Preguntas del PM" (máximo 5, priorizadas). El usuario las responde iterando.
- Cuando el usuario te pida ajustes, reescribe el documento COMPLETO ya corregido (no mandes solo el cambio).`;

function contextBlock(ctx: StationContext, parts: Array<[string, string | undefined]>): string {
  const lines = [`Cliente: ${ctx.clientName}`];
  for (const [label, value] of parts) {
    if (value && value.trim()) {
      lines.push(`\n--- ${label} ---\n${value.trim()}`);
    }
  }
  return lines.join("\n");
}

// ── Estaciones ──────────────────────────────────────────────────────────────

export const STATIONS: StationConfig[] = [
  {
    id: "boceto",
    order: 0,
    stepLabel: "Boceto",
    title: "Estación 1 — Boceto",
    sealName: "Origen Note",
    approveLabel: "Esto es exactamente lo que quiero",
    deliverable: true,
    exportSlug: "origen",
    hint: "La IA aterriza tu descarga mental en un boceto estructurado.",
    systemPrompt: `${PM_PERSONA}

ESTACIÓN 1 — BOCETO.
A partir de la "descarga mental" del usuario (idea cruda, problemas a resolver, todo lo que trae en la cabeza), aterriza la idea en un boceto claro y estructurado.

El documento empieza con "# Origen Note" y contiene estas secciones:
## Problema
## Solución propuesta
## Usuarios objetivo
## Propuesta de valor
## Supuestos y riesgos

Reta lo que esté vago o contradictorio. Donde falte información, propón un supuesto explícito en vez de dejar el hueco.`,
    buildKickoffMessage: (ctx) =>
      `${contextBlock(ctx, [["Descarga mental del usuario", ctx.brainDump]])}

Genera el "Origen Note" (boceto) a partir de esta descarga mental.`,
  },
  {
    id: "funciones",
    order: 1,
    stepLabel: "Funciones",
    title: "Estación 2a — Lista de funciones",
    sealName: "Lista de funciones",
    approveLabel: "Apruebo la lista",
    deliverable: false,
    hint: "La IA imagina la lista COMPLETA de funciones posibles (sin recortar todavía).",
    systemPrompt: `${PM_PERSONA}

ESTACIÓN 2a — LISTA DE FUNCIONES.
Con base en el Origen Note ya sellado, genera la lista MÁS COMPLETA posible de funciones que este producto podría tener. Aquí NO se recorta nada — sé exhaustivo y ambicioso, imagina todo lo que aporte valor.

El documento empieza con "# Lista de funciones" y agrupa las funciones por dominio/módulo con subtítulos "## {Dominio}". Cada función es un bullet con nombre en negritas y una descripción de una línea:
- **Nombre de la función** — qué hace, en una línea.

Mantén el formato de lista estable y parejo (la siguiente estación va a recortar sobre esta lista).`,
    buildKickoffMessage: (ctx) =>
      `${contextBlock(ctx, [["Origen Note (sellado)", ctx.sealed.boceto]])}

Genera la lista completa de funciones imaginables para este producto.`,
  },
  {
    id: "mvp",
    order: 2,
    stepLabel: "Recorte MVP",
    title: "Estación 2b — Recorte MVP",
    sealName: "MVP 1.0",
    approveLabel: "Apruebo el MVP",
    deliverable: true,
    exportSlug: "mvp",
    hint: "La IA recorta a la característica central sin la cual no hay producto.",
    systemPrompt: `${PM_PERSONA}

ESTACIÓN 2b — RECORTE MVP.
A partir de la lista de funciones ya sellada, identifica LA característica central sin la cual el producto no tendría sentido, y define el MVP 1.0: el núcleo mínimo imprescindible alrededor de esa característica. Sé AGRESIVO recortando y defiende el recorte.

El documento tiene DOS secciones de primer nivel obligatorias:

# MVP 1.0
(La función central + lo mínimo imprescindible para que funcione. Justifica por qué cada cosa se queda. Lista breve y priorizada.)

# Congeladora
(Toda función que se recorta del MVP. Por cada una: nombre, razón de una línea del recorte, y la condición o momento en que valdría la pena descongelarla.)

Empieza el documento con "# MVP 1.0".`,
    buildKickoffMessage: (ctx) =>
      `${contextBlock(ctx, [
        ["Origen Note (sellado)", ctx.sealed.boceto],
        ["Lista de funciones (sellada)", ctx.sealed.funciones],
      ])}

Recorta al MVP 1.0 y manda a la Congeladora lo que no sea imprescindible.`,
  },
  {
    id: "flujo",
    order: 3,
    stepLabel: "Flujo",
    title: "Estación 3 — Flujo de usuario",
    sealName: "Flujo de Usuario",
    approveLabel: "Apruebo el flujo",
    deliverable: true,
    exportSlug: "flujo",
    hint: "La IA traza el flujo de usuario del MVP.",
    systemPrompt: `${PM_PERSONA}

ESTACIÓN 3 — FLUJO DE USUARIO.
Con base en el MVP 1.0 ya sellado (ignora la Congeladora: esas funciones NO existen para este flujo), traza el flujo de usuario del producto.

El documento empieza con "# Flujo de Usuario" y contiene:
## Camino principal (happy path)
Pasos numerados desde el primer contacto del usuario hasta que logra el valor central. Por cada paso indica: qué hace el usuario, qué pantalla/acción implica, y qué resultado obtiene.
## Estados vacíos y de error clave
Los momentos sin datos o donde algo puede salir mal, y cómo se resuelven.

Solo sobre lo que quedó en el MVP 1.0.`,
    buildKickoffMessage: (ctx) =>
      `${contextBlock(ctx, [
        ["Origen Note (sellado)", ctx.sealed.boceto],
        ["MVP 1.0 (sellado)", ctx.sealed.mvp],
      ])}

Traza el flujo de usuario del MVP 1.0.`,
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

const BY_ID = new Map(STATIONS.map((s) => [s.id, s]));

export function getStationConfig(id: DefinitionStation): StationConfig {
  const cfg = BY_ID.get(id);
  if (!cfg) throw new Error(`Estación desconocida: ${id}`);
  return cfg;
}

/** Config por slug de export (origen/mvp/flujo). */
export function getStationByExportSlug(
  slug: string
): StationConfig | undefined {
  return STATIONS.find((s) => s.exportSlug === slug);
}

/** Las 3 estaciones cuyo sello es un documento descargable, en orden. */
export const DELIVERABLE_STATIONS = STATIONS.filter((s) => s.deliverable);

// Sanity: la config cubre exactamente la secuencia canónica.
if (STATIONS.length !== STATION_SEQUENCE.length) {
  throw new Error("STATIONS no coincide con STATION_SEQUENCE");
}
