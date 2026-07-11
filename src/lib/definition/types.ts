/**
 * Tipos y orden canónico de las estaciones de "Definición de Proyecto".
 *
 * Módulo compartido y liviano (sin prompts, sin dependencias de DB ni de
 * cliente) para que TANTO la capa de datos (repos) COMO el motor de estaciones
 * (stations.ts) usen la MISMA secuencia. El orden es lo que deriva la
 * compuerta (gating), el avance al sellar y la invalidación downstream al
 * reabrir.
 */

export const STATION_SEQUENCE = ["boceto", "funciones", "mvp", "flujo"] as const;

export type DefinitionStation = (typeof STATION_SEQUENCE)[number];

export function stationOrder(station: DefinitionStation): number {
  return STATION_SEQUENCE.indexOf(station);
}

/** La estación siguiente en la secuencia, o null si `station` es la última. */
export function nextStation(station: DefinitionStation): DefinitionStation | null {
  const i = stationOrder(station);
  return STATION_SEQUENCE[i + 1] ?? null;
}

/** true si `candidate` va DESPUÉS de `station` en la secuencia. */
export function isDownstream(
  station: DefinitionStation,
  candidate: DefinitionStation
): boolean {
  return stationOrder(candidate) > stationOrder(station);
}

export function isValidStation(value: string): value is DefinitionStation {
  return (STATION_SEQUENCE as readonly string[]).includes(value);
}
