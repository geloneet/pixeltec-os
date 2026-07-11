/**
 * Metadatos de presentación de las estaciones — SIN prompts, SIN dependencias
 * de servidor. Seguro de importar desde componentes cliente (los system
 * prompts viven aparte en stations.ts para no enviarlos al bundle del browser).
 */
import type { DefinitionStation } from "@/lib/definition/types";
import { STATION_SEQUENCE } from "@/lib/definition/types";

export interface StationMeta {
  id: DefinitionStation;
  order: number;
  stepLabel: string;
  title: string;
  sealName: string;
  approveLabel: string;
  deliverable: boolean;
  exportSlug?: "origen" | "mvp" | "flujo";
  hint: string;
}

export const STATION_META: StationMeta[] = [
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
  },
];

const META_BY_ID = new Map(STATION_META.map((m) => [m.id, m]));

export function getStationMeta(id: DefinitionStation): StationMeta {
  const m = META_BY_ID.get(id);
  if (!m) throw new Error(`Estación desconocida: ${id}`);
  return m;
}

export function getMetaByExportSlug(slug: string): StationMeta | undefined {
  return STATION_META.find((m) => m.exportSlug === slug);
}

export const DELIVERABLE_META = STATION_META.filter((m) => m.deliverable);

if (STATION_META.length !== STATION_SEQUENCE.length) {
  throw new Error("STATION_META no coincide con STATION_SEQUENCE");
}
