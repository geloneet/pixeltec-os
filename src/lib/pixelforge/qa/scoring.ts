/**
 * `computeQaScore` — scoring determinista de una corrida de QA (PF-F8),
 * verbatim del plan maestro. Módulo puro: sin DB, sin fecha, sin
 * aleatoriedad — misma entrada produce siempre la misma salida.
 *
 * Modelo: 8 categorías, cada una parte de 100 y se penaliza por severidad de
 * sus hallazgos (con un tope por `checkCode` para que un check ruidoso no
 * arrastre la categoría a 0 él solo); el `scoreTotal` es el promedio
 * ponderado de las categorías; el `verdict` aplica un cortocircuito de 4
 * reglas en ORDEN (blocking > umbrales de score > pass estricto > warnings).
 */
import type { QaFindingInput } from "./catalog";

export const QA_SCORING_VERSION = "1";

type Severity = "critical" | "major" | "minor" | "info";

/** Penalización de puntos por severidad — `info` no penaliza (es solo señal). */
const SEVERITY_PENALTY: Readonly<Record<Severity, number>> = {
  critical: 40,
  major: 15,
  minor: 5,
  info: 0,
};

/** Tope de penalización por `checkCode` dentro de una categoría: 3× la penalización de severidad más alta que ese checkCode produjo. */
const CHECK_CODE_PENALTY_CAP_MULTIPLIER = 3;

/**
 * Pesos base (suman 100) — `capacidades` se redistribuye proporcionalmente
 * entre las demás categorías con peso >0 cuando `treeUsesCapabilities` es
 * `false` (el árbol no tiene ningún nodo capability, así que penalizar/premiar
 * esa categoría no tiene sentido). `ia` siempre pesa 0 (advisory).
 */
export const CATEGORY_BASE_WEIGHTS: Readonly<Record<string, number>> = {
  estructura: 20,
  diseno: 15,
  visual: 15,
  accesibilidad: 15,
  tecnico: 15,
  motion: 10,
  capacidades: 10,
  ia: 0,
};

/** scoreTotal < este umbral → FAIL (regla 2). */
const SCORE_FAIL_THRESHOLD = 75;
/** Cualquier categoría con peso >0 y score < este umbral → FAIL (regla 2). */
const CATEGORY_FAIL_THRESHOLD = 50;
/** scoreTotal >= este umbral (+ 0 major + fases completas) → PASS estricto (regla 3). */
const SCORE_PASS_THRESHOLD = 90;

export interface QaScoreInput {
  findings: Pick<QaFindingInput, "checkCode" | "category" | "severity" | "blocking">[];
  /** `false` si el árbol de la versión evaluada no usa ninguna capability — dispara la redistribución de peso. */
  treeUsesCapabilities: boolean;
  phasesComplete: { deterministic: boolean; browser: boolean };
}

export interface QaCategoryScore {
  score: number;
  weight: number;
  penalty: number;
  findings: number;
}

export interface QaScoreResult {
  scoreTotal: number;
  verdict: "pass" | "pass_with_warnings" | "fail";
  categoryScores: Record<string, QaCategoryScore>;
}

function penaltyFor(severity: string): number {
  return SEVERITY_PENALTY[severity as Severity] ?? 0;
}

/**
 * Pesos finales de las 8 categorías. Si `treeUsesCapabilities` es `false`,
 * el peso de `capacidades` (10) se redistribuye proporcionalmente entre las
 * demás categorías con peso base >0 (excluye `ia`, que ya pesa 0) — los
 * weights reportados siguen sumando 100.
 */
function resolveCategoryWeights(treeUsesCapabilities: boolean): Record<string, number> {
  if (treeUsesCapabilities) return { ...CATEGORY_BASE_WEIGHTS };

  const capabilitiesWeight = CATEGORY_BASE_WEIGHTS.capacidades;
  const redistributionTargets = Object.entries(CATEGORY_BASE_WEIGHTS).filter(
    ([category, weight]) => category !== "capacidades" && weight > 0
  );
  const targetWeightSum = redistributionTargets.reduce((sum, [, weight]) => sum + weight, 0);

  const weights: Record<string, number> = { ...CATEGORY_BASE_WEIGHTS, capacidades: 0 };
  for (const [category, weight] of redistributionTargets) {
    weights[category] = weight + (capabilitiesWeight * weight) / targetWeightSum;
  }
  return weights;
}

export function computeQaScore(input: QaScoreInput): QaScoreResult {
  const weights = resolveCategoryWeights(input.treeUsesCapabilities);

  const findingsCountByCategory = new Map<string, number>();
  // Agrupado por "category|checkCode" para aplicar el tope 3x por checkCode.
  const penaltyGroups = new Map<string, { total: number; maxSingle: number }>();

  for (const finding of input.findings) {
    findingsCountByCategory.set(finding.category, (findingsCountByCategory.get(finding.category) ?? 0) + 1);

    const groupKey = `${finding.category}|${finding.checkCode}`;
    const penalty = penaltyFor(finding.severity);
    const group = penaltyGroups.get(groupKey) ?? { total: 0, maxSingle: 0 };
    group.total += penalty;
    group.maxSingle = Math.max(group.maxSingle, penalty);
    penaltyGroups.set(groupKey, group);
  }

  const appliedPenaltyByCategory = new Map<string, number>();
  for (const [groupKey, { total, maxSingle }] of penaltyGroups) {
    const category = groupKey.split("|")[0]!;
    const cap = CHECK_CODE_PENALTY_CAP_MULTIPLIER * maxSingle;
    const applied = Math.min(total, cap);
    appliedPenaltyByCategory.set(category, (appliedPenaltyByCategory.get(category) ?? 0) + applied);
  }

  const categoryScores: Record<string, QaCategoryScore> = {};
  let weightedScoreSum = 0;

  for (const category of Object.keys(weights)) {
    const weight = weights[category]!;
    const penalty = Math.min(appliedPenaltyByCategory.get(category) ?? 0, 100);
    const score = Math.max(0, 100 - penalty);

    categoryScores[category] = {
      score,
      weight,
      penalty,
      findings: findingsCountByCategory.get(category) ?? 0,
    };
    weightedScoreSum += (weight * score) / 100;
  }

  const scoreTotal = Math.round(weightedScoreSum);
  const verdict = resolveVerdict(input, scoreTotal, categoryScores);

  return { scoreTotal, verdict, categoryScores };
}

function resolveVerdict(
  input: QaScoreInput,
  scoreTotal: number,
  categoryScores: Record<string, QaCategoryScore>
): QaScoreResult["verdict"] {
  // Regla 1: cualquier hallazgo blocking=true fuerza FAIL, sin importar el score.
  const hasBlockingFinding = input.findings.some((finding) => finding.blocking === true);
  if (hasBlockingFinding) return "fail";

  // Regla 2: scoreTotal por debajo del umbral, o alguna categoría con peso >0
  // por debajo de su propio umbral, fuerza FAIL.
  const anyWeightedCategoryTooLow = Object.values(categoryScores).some(
    (category) => category.weight > 0 && category.score < CATEGORY_FAIL_THRESHOLD
  );
  if (scoreTotal < SCORE_FAIL_THRESHOLD || anyWeightedCategoryTooLow) return "fail";

  // Regla 3: PASS estricto — score alto, cero hallazgos major, y ambas fases completas.
  const majorFindingsCount = input.findings.filter((finding) => finding.severity === "major").length;
  const bothPhasesComplete = input.phasesComplete.deterministic && input.phasesComplete.browser;
  if (scoreTotal >= SCORE_PASS_THRESHOLD && majorFindingsCount === 0 && bothPhasesComplete) {
    return "pass";
  }

  // Regla 4: cualquier otro caso que sobrevivió las reglas 1-2.
  return "pass_with_warnings";
}
