/**
 * Metadatos de presentación de las estaciones de PixelForge — SIN prompts,
 * SIN dependencias de servidor. Seguro de importar desde componentes cliente.
 */
import type { PixelforgeStation } from "@/lib/pixelforge/types";
import { PIXELFORGE_STATION_SEQUENCE } from "@/lib/pixelforge/types";

export interface StationMeta {
  id: PixelforgeStation;
  order: number;
  stepLabel: string;
  title: string;
  hint: string;
  /** Número de fase de PixelForge que habilita esta estación. */
  phase: number;
}

export const STATION_META: StationMeta[] = [
  {
    id: "contexto",
    order: 0,
    stepLabel: "Contexto",
    title: "Estación 1 — Contexto",
    hint: "La IA reúne el contexto del negocio y la marca antes de diseñar la landing.",
    phase: 1,
  },
  {
    id: "estrategia",
    order: 1,
    stepLabel: "Estrategia",
    title: "Estación 2 — Estrategia",
    hint: "La IA define el ADN estratégico de la landing: propuesta de valor y posicionamiento.",
    phase: 3,
  },
  {
    id: "visual",
    order: 2,
    stepLabel: "Visual",
    title: "Estación 3 — Visual",
    hint: "La IA propone el ADN visual: paleta, tipografía y tono estético.",
    phase: 4,
  },
  {
    id: "direcciones",
    order: 3,
    stepLabel: "Direcciones",
    title: "Estación 4 — Direcciones",
    hint: "La IA genera direcciones creativas y ayuda a decidir cuál seguir.",
    phase: 5,
  },
  {
    id: "blueprint",
    order: 4,
    stepLabel: "Blueprint",
    title: "Estación 5 — Blueprint",
    hint: "La IA arma el blueprint narrativo completo de la landing.",
    phase: 6,
  },
  {
    id: "produccion",
    order: 5,
    stepLabel: "Producción",
    title: "Estación 6 — Producción",
    hint: "La IA produce la landing a partir del blueprint aprobado.",
    phase: 7,
  },
  {
    id: "qa",
    order: 6,
    stepLabel: "QA",
    title: "Estación 7 — QA",
    hint: "La IA revisa la landing producida contra el blueprint y el ADN de marca.",
    phase: 8,
  },
  {
    id: "revision",
    order: 7,
    stepLabel: "Revisión",
    title: "Estación 8 — Revisión",
    hint: "Revisión final antes de publicar la landing.",
    phase: 9,
  },
];

const META_BY_ID = new Map(STATION_META.map((m) => [m.id, m]));

export function getStationMeta(id: PixelforgeStation): StationMeta {
  const m = META_BY_ID.get(id);
  if (!m) throw new Error(`Estación desconocida: ${id}`);
  return m;
}

if (STATION_META.length !== PIXELFORGE_STATION_SEQUENCE.length) {
  throw new Error("STATION_META no coincide con PIXELFORGE_STATION_SEQUENCE");
}
