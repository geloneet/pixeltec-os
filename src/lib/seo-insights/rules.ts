/**
 * Las cuatro reglas de contenido (WO-2026-00214).
 *
 * ESTADO: funciones puras con tests, **no conectadas a ningún cron**. Esto es
 * Fase 1; hacerlas correr solas y notificar es Fase 3, fuera de este WO. Se
 * adelantan ahora por dos motivos: son testeables hoy con fixtures y sin datos
 * reales, y escribirlas obliga a comprobar que el modelo de datos las soporta
 * antes de que sea caro cambiarlo.
 *
 * Todas respetan pisos configurables. Sin ellos, una página con 3 impresiones
 * y 0 clics dispararía "mejorar CTR" — ruido estadístico presentado como
 * recomendación, que es la forma más rápida de que nadie vuelva a mirar el
 * módulo.
 *
 * Diseño: docs/superpowers/specs/2026-09-03-seo-contenido-design.md
 */

import { DEFAULT_THRESHOLDS, type SeoThresholds } from "./config";

export const SEO_RULE_IDS = ["update", "improve_ctr", "review_cta", "dead_content"] as const;
export type SeoRuleId = (typeof SEO_RULE_IDS)[number];

export interface RuleSubject {
  path: string;
  /** Métricas de Search Console de la ventana; `null` si no está conectado. */
  gsc: { clicks: number; impressions: number; ctr: number; position: number } | null;
  /** Conteos de `content_events` de la ventana. */
  visits: number;
  reads: number;
  ctaClicks: number;
  leads: number;
}

export interface RuleFinding {
  rule: SeoRuleId;
  path: string;
  /** Frase corta y accionable, en español, sin jerga de métricas. */
  message: string;
  /** `high` solo cuando la pérdida es cuantificable y grande. */
  severity: "high" | "medium" | "low";
}

/**
 * CTR esperable para una posición media. Valores conservadores y redondos a
 * propósito: no son un estudio, son un umbral de "esto está claramente por
 * debajo de lo normal". Si alguien los toma por verdad de industria, la regla
 * ya está mal usada.
 */
function expectedCtr(position: number): number {
  if (position <= 1.5) return 0.2;
  if (position <= 3) return 0.1;
  if (position <= 5) return 0.05;
  return 0.02;
}

/**
 * R1 — Actualizar: hay demanda (impresiones por encima del piso) y la página
 * está en la zona media (5-20). Ni gana ni está fuera de juego: es donde una
 * actualización rinde más.
 */
export function ruleUpdate(s: RuleSubject, t: SeoThresholds = DEFAULT_THRESHOLDS): RuleFinding | null {
  if (!s.gsc) return null;
  if (s.gsc.impressions < t.minImpressions) return null;
  if (s.gsc.position <= t.topPosition || s.gsc.position > t.tailPosition) return null;
  return {
    rule: "update",
    path: s.path,
    message: `Posición media ${s.gsc.position.toFixed(1)} con ${s.gsc.impressions} impresiones: hay demanda que este contenido no está capturando. Actualizarlo es lo que más rinde.`,
    severity: s.gsc.impressions >= t.minImpressions * 5 ? "high" : "medium",
  };
}

/**
 * R2 — Mejorar CTR: la página YA está arriba pero se hace clic poco. El
 * problema no es el contenido, es el título y la meta description.
 */
export function ruleImproveCtr(s: RuleSubject, t: SeoThresholds = DEFAULT_THRESHOLDS): RuleFinding | null {
  if (!s.gsc) return null;
  if (s.gsc.impressions < t.minImpressions) return null;
  if (s.gsc.position > t.topPosition) return null;
  const target = expectedCtr(s.gsc.position);
  if (s.gsc.ctr >= target) return null;
  return {
    rule: "improve_ctr",
    path: s.path,
    message: `En posición ${s.gsc.position.toFixed(1)} el CTR es ${(s.gsc.ctr * 100).toFixed(1)}% (esperable ≈ ${(target * 100).toFixed(0)}%). Revisa el título y la meta description, no el cuerpo.`,
    severity: s.gsc.ctr < target / 2 ? "high" : "medium",
  };
}

/**
 * R3 — Revisar CTA: la gente llega y LEE (no rebota), y aun así nadie pulsa
 * nada. El contenido funciona; la conversión no. No exige datos de Search
 * Console: se responde entera con eventos first-party.
 */
export function ruleReviewCta(s: RuleSubject, t: SeoThresholds = DEFAULT_THRESHOLDS): RuleFinding | null {
  if (s.visits < t.minVisits) return null;
  if (s.reads === 0) return null;
  if (s.ctaClicks > 0) return null;
  return {
    rule: "review_cta",
    path: s.path,
    message: `${s.visits} visitas y ${s.reads} lecturas completas, cero clics en CTA. El contenido retiene y la llamada a la acción no convierte.`,
    severity: s.reads >= t.minVisits ? "high" : "medium",
  };
}

/**
 * R4 — Contenido muerto: ni se ve en Google ni recibe visitas en toda la
 * ventana. Sin datos de Search Console la regla exige además que las visitas
 * sean cero: "no aparece en buscadores" no se puede afirmar sin GSC.
 */
export function ruleDeadContent(s: RuleSubject, _t: SeoThresholds = DEFAULT_THRESHOLDS): RuleFinding | null {
  const noSearch = s.gsc === null ? true : s.gsc.impressions === 0;
  if (!noSearch || s.visits > 0) return null;
  return {
    rule: "dead_content",
    path: s.path,
    message:
      s.gsc === null
        ? "Cero visitas en la ventana. Sin Search Console conectado no se puede saber si además está fuera del índice."
        : "Cero impresiones y cero visitas en la ventana: nadie lo encuentra ni llega a él.",
    severity: "low",
  };
}

const ALL_RULES = [ruleUpdate, ruleImproveCtr, ruleReviewCta, ruleDeadContent] as const;

/**
 * Evalúa las cuatro reglas sobre un contenido. Devuelve todos los hallazgos
 * (una página puede disparar varias); ordenados por severidad para que la
 * lista se lea de lo más urgente a lo menos.
 */
export function evaluateRules(
  subject: RuleSubject,
  thresholds: SeoThresholds = DEFAULT_THRESHOLDS
): RuleFinding[] {
  const order: Record<RuleFinding["severity"], number> = { high: 0, medium: 1, low: 2 };
  return ALL_RULES.map((rule) => rule(subject, thresholds))
    .filter((f): f is RuleFinding => f !== null)
    .sort((a, b) => order[a.severity] - order[b.severity]);
}
