/**
 * Tipos y orden canónico de las estaciones de "PixelForge" (landings por
 * estaciones).
 *
 * Módulo compartido y liviano (sin prompts, sin dependencias de DB ni de
 * cliente) para que TANTO la capa de datos (repos) COMO el motor de estaciones
 * usen la MISMA secuencia. El orden es lo que deriva la compuerta (gating), el
 * avance al sellar y la invalidación downstream al reabrir.
 */

export const PIXELFORGE_STATION_SEQUENCE = [
  "contexto",
  "estrategia",
  "visual",
  "direcciones",
  "blueprint",
  "produccion",
  "qa",
  "revision",
] as const;

export type PixelforgeStation = (typeof PIXELFORGE_STATION_SEQUENCE)[number];

export function stationOrder(station: PixelforgeStation): number {
  return PIXELFORGE_STATION_SEQUENCE.indexOf(station);
}

/** La estación siguiente en la secuencia, o null si `station` es la última. */
export function nextStation(station: PixelforgeStation): PixelforgeStation | null {
  const i = stationOrder(station);
  return PIXELFORGE_STATION_SEQUENCE[i + 1] ?? null;
}

/** true si `candidate` va DESPUÉS de `station` en la secuencia. */
export function isDownstream(
  station: PixelforgeStation,
  candidate: PixelforgeStation
): boolean {
  return stationOrder(candidate) > stationOrder(station);
}

export function isValidStation(value: string): value is PixelforgeStation {
  return (PIXELFORGE_STATION_SEQUENCE as readonly string[]).includes(value);
}

export const ARTIFACT_KINDS = [
  "context_brief",
  "landing_dna",
  "visual_dna",
  "direction_decision",
  "narrative_blueprint",
] as const;

export type PixelforgeArtifactKind = (typeof ARTIFACT_KINDS)[number];

/** Kinds operativos — crece por fase. F4 suma `visual_dna`. F5 suma `direction_decision`. */
export type OperativeArtifactKind =
  | "context_brief"
  | "landing_dna"
  | "visual_dna"
  | "direction_decision";

/**
 * Mapeo estación → artifact que sella. Las estaciones de producción, QA y
 * revisión (fases 7-9, aún no construidas) no sellan un artifact aquí: sus
 * resultados derivan de tablas propias de esas fases futuras.
 */
export const STATION_ARTIFACT: Record<PixelforgeStation, PixelforgeArtifactKind | null> = {
  contexto: "context_brief",
  estrategia: "landing_dna",
  visual: "visual_dna",
  direcciones: "direction_decision",
  blueprint: "narrative_blueprint",
  produccion: null,
  qa: null,
  revision: null,
};

/**
 * Tipos de evento del historial de una estación. Crece por fase: F1 cubre
 * creación e ingesta de fuentes; F2 añade el ciclo sellar/reabrir/invalidar y
 * el arranque/cierre de corridas IA (repo, `src/lib/db/repos/pixelforge.ts`);
 * F4 añade agregar/quitar referencias visuales de la estación `visual`; F5
 * añade generar/regenerar/elegir direcciones creativas de la estación
 * `direcciones`.
 */
export type PixelforgeEventType =
  | "created"
  | "source_added"
  | "sealed"
  | "reopened"
  | "invalidated"
  | "run_started"
  | "run_finished"
  | "reference_added"
  | "reference_removed"
  | "directions_generated"
  | "direction_regenerated"
  | "direction_chosen";

export type PixelforgeArtifactStatus = "pending" | "in_progress" | "sealed" | "invalidated";

export type PixelforgeSourceType = "note" | "document" | "definition_import" | "url";

/**
 * Los kinds POSTERIORES a `kind` en el orden canónico de `ARTIFACT_KINDS`.
 * Vacío si `kind` es el último. Usado por `reopenArtifact` (repo) para saber
 * qué sellos downstream invalidar al reabrir uno anterior.
 */
export function downstreamKinds(kind: PixelforgeArtifactKind): PixelforgeArtifactKind[] {
  const i = ARTIFACT_KINDS.indexOf(kind);
  return ARTIFACT_KINDS.slice(i + 1);
}

/**
 * Inversa de `STATION_ARTIFACT`: la estación que sella un `kind` dado. Total
 * sobre los 5 kinds de F2 (no hace falta manejar `null` — a diferencia de
 * `STATION_ARTIFACT`, cada kind tiene exactamente una estación que lo sella).
 */
const KIND_STATION: Record<PixelforgeArtifactKind, PixelforgeStation> = {
  context_brief: "contexto",
  landing_dna: "estrategia",
  visual_dna: "visual",
  direction_decision: "direcciones",
  narrative_blueprint: "blueprint",
};

export function stationForKind(kind: PixelforgeArtifactKind): PixelforgeStation {
  return KIND_STATION[kind];
}
