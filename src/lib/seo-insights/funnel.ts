/**
 * Embudo por pieza de contenido (WO-2026-00214).
 *
 * Función pura: recibe los agregados ya contados y devuelve las filas con su
 * caída. No consulta la base, no lee el reloj y no formatea nada.
 *
 * Decisión central: un paso sin dato vale `null`, NUNCA `0`. Mientras Search
 * Console no esté conectado, impresiones y clics son "no lo sé" — y un cero
 * pintado en su lugar hace que un contenido sano parezca muerto. La UI muestra
 * un estado vacío explícito para los pasos `null`.
 *
 * Diseño: docs/superpowers/specs/2026-09-03-seo-contenido-design.md
 */

import { READ_DEPTH } from "@/lib/analytics/events";

/** Métricas de Search Console de un path, o `null` si no hay snapshot. */
export interface GscPageMetrics {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** Conteos de `content_events` de un path dentro de la ventana. */
export interface ContentEventCounts {
  /** Eventos `view` (sesiones distintas por el dedupe del índice único). */
  views: number;
  /** Eventos `scroll` con `depth >= READ_DEPTH`. */
  reads: number;
  /** Eventos `cta_click`. */
  ctaClicks: number;
}

/** Conteos de `leads` atribuidos al path dentro de la ventana. */
export interface LeadCounts {
  total: number;
  qualified: number;
}

export interface FunnelInput {
  path: string;
  /** `null` mientras Search Console no esté conectado para este path. */
  gscPage: GscPageMetrics | null;
  events: ContentEventCounts;
  leads: LeadCounts;
}

export type FunnelStepKey =
  | "impressions"
  | "clicks"
  | "visits"
  | "reads"
  | "cta_clicks"
  | "leads"
  | "qualified";

export interface FunnelStep {
  key: FunnelStepKey;
  label: string;
  /** `null` = dato no disponible (distinto de 0 = medido y vacío). */
  value: number | null;
  /**
   * Proporción respecto al paso anterior con dato (0.4 = pasó el 40 %).
   * `null` en el primer paso con dato y siempre que falte alguno de los dos.
   */
  conversion: number | null;
  /**
   * Proporción que se PIERDE en este paso (`1 - conversion`). Se precalcula
   * aquí en vez de en la vista para que la tabla no tenga aritmética propia.
   */
  dropoff: number | null;
}

const STEP_LABELS: Record<FunnelStepKey, string> = {
  impressions: "Impresiones",
  clicks: "Clics en Google",
  visits: "Visitas",
  reads: `Lectura ${READ_DEPTH}%`,
  cta_clicks: "Clic en CTA",
  leads: "Leads",
  qualified: "Calificados",
};

/**
 * Construye las filas del embudo, encadenando la conversión con el ÚLTIMO paso
 * que tenía dato — no con el inmediatamente anterior. Así, cuando faltan
 * impresiones y clics, "visitas → lectura" sigue siendo una conversión
 * correcta en vez de quedarse sin base.
 */
export function buildFunnel(input: FunnelInput): FunnelStep[] {
  const raw: Array<{ key: FunnelStepKey; value: number | null }> = [
    { key: "impressions", value: input.gscPage?.impressions ?? null },
    { key: "clicks", value: input.gscPage?.clicks ?? null },
    { key: "visits", value: input.events.views },
    { key: "reads", value: input.events.reads },
    { key: "cta_clicks", value: input.events.ctaClicks },
    { key: "leads", value: input.leads.total },
    { key: "qualified", value: input.leads.qualified },
  ];

  let lastKnown: number | null = null;
  return raw.map(({ key, value }) => {
    let conversion: number | null = null;
    if (value !== null && lastKnown !== null && lastKnown > 0) {
      conversion = value / lastKnown;
    }
    if (value !== null) lastKnown = value;
    return {
      key,
      label: STEP_LABELS[key],
      value,
      conversion,
      dropoff: conversion === null ? null : 1 - conversion,
    };
  });
}

/**
 * El paso donde más se pierde, entre los que tienen conversión calculada.
 * `null` si no hay ninguno — con datos insuficientes no se señala un culpable.
 */
export function worstStep(steps: readonly FunnelStep[]): FunnelStep | null {
  let worst: FunnelStep | null = null;
  for (const step of steps) {
    if (step.dropoff === null) continue;
    if (worst === null || step.dropoff > (worst.dropoff ?? -1)) worst = step;
  }
  return worst;
}

/** `true` si la fila del embudo no tiene ningún dato de Search Console. */
export function isMissingSearchData(steps: readonly FunnelStep[]): boolean {
  return steps.some((s) => (s.key === "impressions" || s.key === "clicks") && s.value === null);
}
