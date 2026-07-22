/**
 * Configs de las 3 operaciones IA advisory de QA (PF-F8 T5):
 * `critique_design`/`score_originality`/`detect_ai_likeness` — checks
 * QA-IA-001/002/003 del catálogo. Viven en este módulo compartido (no en
 * `src/app/api/pixelforge/runs/route.ts`, un route file de Next que no debe
 * cargarse de exports arbitrarios) y los consumen DOS callers:
 *  - `route.ts` las registra en `ENABLED_OPERATIONS` + `createRunSchema`
 *    (diff aditivo) — camino defensivo/directo por HTTP, hoy sin UI que lo
 *    dispare.
 *  - `qa/advisory.ts` (`launchQaAdvisoryRuns`) las invoca directamente
 *    (`loadExtra`/`guard`/`buildRequest`/`persistResult`) — el camino REAL
 *    por el que estas 3 operaciones corren, atadas a un `qa_run` concreto.
 *
 * Cada entrada tiene la MISMA forma estructural que `OperationConfig` de
 * `route.ts` (loadExtra/guard/buildRequest/inputSummary/resultRef/
 * persistResult/domainSchema/promptVersion) — sin importar ese tipo (evitaría
 * un import de un route file); TypeScript valida la compatibilidad
 * estructuralmente en el punto de uso (`ENABLED_OPERATIONS`,
 * `satisfies Record<string, OperationConfig>`), no acá.
 *
 * `AdvisoryOperationCtx` extiende el `OperationRunCtx` de `route.ts` con
 * `qaRunId` — igual que `analyze_reference` exige `referenceId`, estas 3
 * operaciones exigen `qaRunId` (a qué `qa_run` pertenece el resultado): el
 * guard/buildRequest/persistResult lo resuelven vía `loadAdvisoryContext`
 * (ownership-checked, `getQaRunWithFindings`).
 *
 * REGLA DE ORO del plan maestro F8: las 3 son ADVISORY — `blocking: false`
 * SIEMPRE, `source: 'ia'`, severidad `info`/`minor` según el mapeo del
 * catálogo (T2) — nunca `critical`/`major`, nunca pesan en el scoring (eso ya
 * lo garantizan catálogo/scoring de T2, este módulo no lo duplica).
 */
import type { PixelforgeProjectFull } from "@/lib/db/repos/pixelforge";
import { getQaRunWithFindings, getPageVersionInternal, insertQaFindings, type InsertQaFindingInput } from "@/lib/db/repos/pixelforge";
import type { PixelforgeQaRun, PixelforgePageVersion } from "@/lib/db/schema";
import { validatePageTree } from "../registry/validate-page-tree";
import type { Direccion } from "../schemas/generate-directions";
import { narrativeBlueprintSchema, type NarrativeBlueprint } from "../schemas/build-narrative";
import { designCritiqueSchema, type Rubric, type Criterio } from "../schemas/critique-design";
import { originalityScoreSchema } from "../schemas/score-originality";
import { aiLikenessSchema, type AiLikeness } from "../schemas/detect-ai-likeness";
import { getCheckDefinition, IA_RUBRIC_MINOR_THRESHOLD } from "./catalog";
import type { PageTreeForCopy } from "./extract-copy";
import { buildCritiqueDesignRequest, CRITIQUE_DESIGN_PROMPT_VERSION } from "../ai/prompts/critique-design.v1";
import { buildScoreOriginalityRequest, SCORE_ORIGINALITY_PROMPT_VERSION } from "../ai/prompts/score-originality.v1";
import { buildDetectAiLikenessRequest, DETECT_AI_LIKENESS_PROMPT_VERSION } from "../ai/prompts/detect-ai-likeness.v1";

/** `OperationRunCtx` de `route.ts` + `qaRunId` (requerido para estas 3 operaciones, análogo a `referenceId` de `analyze_reference`). */
export interface AdvisoryOperationCtx {
  referenceId?: string;
  ownerId: string;
  slot?: number;
  qaRunId?: string;
}

export interface LoadedAdvisoryContext {
  qaRun: PixelforgeQaRun;
  pageVersion: PixelforgePageVersion;
}

/**
 * Resuelve `ctx.qaRunId` a la corrida de QA + su versión de página evaluada,
 * ownership-checked (`getQaRunWithFindings`, descarta los findings — solo
 * necesitamos la fila `run`) y cross-checked contra `full.project.id` (mismo
 * criterio que `analyze_reference`: pertenecer al owner NO basta, debe
 * pertenecer también al proyecto de este body). `null` si `qaRunId` falta, el
 * run no existe/no es del owner, no pertenece a este proyecto, o su versión
 * de página ya no existe.
 */
export async function loadAdvisoryContext(
  full: PixelforgeProjectFull,
  ctx: AdvisoryOperationCtx
): Promise<LoadedAdvisoryContext | null> {
  if (!ctx.qaRunId) return null;
  const withFindings = await getQaRunWithFindings(ctx.qaRunId, ctx.ownerId);
  if (!withFindings || withFindings.run.projectId !== full.project.id) return null;
  const pageVersion = await getPageVersionInternal(withFindings.run.pageVersionId);
  if (!pageVersion) return null;
  return { qaRun: withFindings.run, pageVersion };
}

/**
 * Guard compartido por las 3 operaciones: exige un `qa_run` `running` para
 * este proyecto (409 "No hay un QA en curso para este proyecto" si no lo
 * hay) Y que el FK advisory correspondiente de ESE `qa_run` siga vacío — si
 * ya está seteado, esta operación ya se lanzó para este run (evita crear un
 * `ai_run` huérfano, nunca referenciado por ningún FK, ante una segunda
 * invocación directa por HTTP).
 */
function makeGuard(fkField: "critiqueRunId" | "originalityRunId" | "likenessRunId", label: string) {
  return (full: PixelforgeProjectFull, ctx: AdvisoryOperationCtx, extra: unknown): string | null => {
    void full;
    void ctx;
    const loaded = extra as LoadedAdvisoryContext | null;
    if (!loaded || loaded.qaRun.status !== "running") {
      return "No hay un QA en curso para este proyecto";
    }
    if (loaded.qaRun[fkField] !== null) {
      return `${label} ya se lanzó para este QA`;
    }
    return null;
  };
}

/** La dirección `chosen` ACTUAL del proyecto, resumida para las 2 operaciones que la usan — `null` si no hay ninguna (QA-DI-006 ya lo reporta aparte; acá solo degrada con gracia). */
function resolveChosenDirection(full: PixelforgeProjectFull): {
  concept: string;
  designTokens: Direccion["designTokens"];
  signatureMotif: Direccion["signatureMotif"];
} | null {
  const chosen = full.directions.find((d) => d.id === full.project.chosenDirectionId && d.status === "chosen");
  if (!chosen) return null;
  return {
    concept: chosen.concept,
    // jsonb (`unknown` en Drizzle) — mismo criterio de cast que `compose_page_tree`/`build_narrative` en `route.ts`.
    designTokens: chosen.designTokens as Direccion["designTokens"],
    signatureMotif: chosen.signatureMotif as Direccion["signatureMotif"],
  };
}

/** Actos del Blueprint Narrativo sellado del proyecto — `[]` si no hay Blueprint sellado disponible (degrada con gracia, mismo criterio que `resolveChosenDirection`). */
function resolveActos(full: PixelforgeProjectFull): NarrativeBlueprint["actos"] {
  const blueprintArtifact = full.artifacts.find((a) => a.kind === "narrative_blueprint");
  if (!blueprintArtifact?.sealedContent) return [];
  return narrativeBlueprintSchema.parse(blueprintArtifact.sealedContent).actos;
}

/**
 * Re-valida el árbol persistido con `validatePageTree` (defensa en
 * profundidad — mismo criterio que `compose_page_tree.persistResult` en
 * `route.ts`): la versión de página ya pasó esta validación al componerse,
 * pero nunca se confía a ciegas en un jsonb persistido. Lanza si no valida
 * (no debería pasar nunca en la práctica — el ai_run termina failed por la
 * taxonomía normal del motor).
 */
function resolveValidatedTree(pageVersion: PixelforgePageVersion): PageTreeForCopy {
  const validation = validatePageTree(pageVersion.tree);
  if (!validation.ok) {
    throw new Error(`El árbol de la versión evaluada (QA IA advisory) no valida: ${validation.errors.join(" | ")}`);
  }
  return validation.tree;
}

function countValidatedNodes(pageVersion: PixelforgePageVersion): number {
  const validation = validatePageTree(pageVersion.tree);
  return validation.ok ? validation.tree.nodes.length : 0;
}

// ─── Findings — rúbrica → hallazgo advisory (QA-IA-001/002/003) ────────────

function worstCriterio(rubric: Rubric): Criterio {
  return [...rubric.criteria].sort((a, b) => a.score - b.score)[0]!;
}

/** Mapeo de severidad del catálogo (T2): score de rúbrica < `IA_RUBRIC_MINOR_THRESHOLD` → `minor`, si no → `info`. Nunca `critical`/`major` — regla de oro advisory. */
function severityForRubricScore(score: number): "minor" | "info" {
  return score < IA_RUBRIC_MINOR_THRESHOLD ? "minor" : "info";
}

async function persistRubricFinding(params: {
  qaRunId: string;
  checkCode: "QA-IA-001" | "QA-IA-002";
  rubric: Rubric;
  titlePrefix: string;
}): Promise<void> {
  const { qaRunId, checkCode, rubric, titlePrefix } = params;
  const check = getCheckDefinition(checkCode)!;
  const peor = worstCriterio(rubric);
  const finding: InsertQaFindingInput = {
    checkCode,
    category: "ia",
    severity: severityForRubricScore(rubric.score),
    blocking: false,
    source: "ia",
    title: `${titlePrefix}: ${rubric.veredicto}`,
    description: `Criterio más débil — "${peor.nombre}" (score ${peor.score}/100): ${peor.reasons.join(" ")}`,
    recommendation: peor.warnings[0] ?? check.recommendation,
    evidence: rubric,
    location: null,
    locationKey: "-",
  };
  await insertQaFindings(qaRunId, [finding]);
}

async function persistLikenessFindings(qaRunId: string, likeness: AiLikeness): Promise<void> {
  if (likeness.senalesDetectadas.length === 0) return; // sin señales — resultado positivo, nada que reportar.
  const check = getCheckDefinition("QA-IA-003")!;
  const findings: InsertQaFindingInput[] = likeness.senalesDetectadas.map((senal, index) => ({
    checkCode: "QA-IA-003",
    category: "ia",
    severity: "info",
    blocking: false,
    source: "ia",
    title: `Señal de semejanza IA: ${senal}`,
    description: `Detectada en la landing compuesta (veredicto general: ${likeness.veredicto}, score ${likeness.score}/100).`,
    recommendation: check.recommendation,
    evidence: { senal, rubric: likeness },
    location: null,
    locationKey: `sig:${index}`,
  }));
  await insertQaFindings(qaRunId, findings);
}

function requireQaRunId(ctx: AdvisoryOperationCtx, operation: string): string {
  if (!ctx.qaRunId) {
    throw new Error(`Falta qaRunId para persistir el resultado de ${operation}`);
  }
  return ctx.qaRunId;
}

// ─── critique_design (QA-IA-001) ───────────────────────────────────────────

export const critiqueDesignOperation = {
  loadExtra: loadAdvisoryContext,
  guard: makeGuard("critiqueRunId", "La crítica de diseño IA"),
  buildRequest: (full: PixelforgeProjectFull, ctx: AdvisoryOperationCtx, extra: unknown) => {
    void ctx;
    const { pageVersion } = extra as LoadedAdvisoryContext;
    return buildCritiqueDesignRequest({
      title: full.project.title,
      tree: resolveValidatedTree(pageVersion),
      chosenDirection: resolveChosenDirection(full),
      actos: resolveActos(full),
    });
  },
  inputSummary: (full: PixelforgeProjectFull, ctx: AdvisoryOperationCtx, extra: unknown) => {
    void ctx;
    const loaded = extra as LoadedAdvisoryContext | null;
    return {
      nodeCount: loaded ? countValidatedNodes(loaded.pageVersion) : 0,
      hasChosenDirection: resolveChosenDirection(full) !== null,
      hasBlueprint: full.artifacts.some((a) => a.kind === "narrative_blueprint" && a.sealedContent != null),
    };
  },
  resultRef: (ctx: AdvisoryOperationCtx) => `qa_run:${ctx.qaRunId}`,
  persistResult: async (output: unknown, ctx: AdvisoryOperationCtx) => {
    const qaRunId = requireQaRunId(ctx, "critique_design");
    const rubric = designCritiqueSchema.parse(output);
    await persistRubricFinding({ qaRunId, checkCode: "QA-IA-001", rubric, titlePrefix: "Crítica de diseño IA" });
  },
  domainSchema: undefined,
  promptVersion: CRITIQUE_DESIGN_PROMPT_VERSION,
};

// ─── score_originality (QA-IA-002) ─────────────────────────────────────────

export const scoreOriginalityOperation = {
  loadExtra: loadAdvisoryContext,
  guard: makeGuard("originalityRunId", "El score de originalidad IA"),
  buildRequest: (full: PixelforgeProjectFull, ctx: AdvisoryOperationCtx, extra: unknown) => {
    void ctx;
    const { pageVersion } = extra as LoadedAdvisoryContext;
    return buildScoreOriginalityRequest({
      title: full.project.title,
      tree: resolveValidatedTree(pageVersion),
      chosenDirection: resolveChosenDirection(full),
      actos: resolveActos(full),
    });
  },
  inputSummary: (full: PixelforgeProjectFull, ctx: AdvisoryOperationCtx, extra: unknown) => {
    void ctx;
    const loaded = extra as LoadedAdvisoryContext | null;
    return {
      nodeCount: loaded ? countValidatedNodes(loaded.pageVersion) : 0,
      hasChosenDirection: resolveChosenDirection(full) !== null,
      hasBlueprint: full.artifacts.some((a) => a.kind === "narrative_blueprint" && a.sealedContent != null),
    };
  },
  resultRef: (ctx: AdvisoryOperationCtx) => `qa_run:${ctx.qaRunId}`,
  persistResult: async (output: unknown, ctx: AdvisoryOperationCtx) => {
    const qaRunId = requireQaRunId(ctx, "score_originality");
    const rubric = originalityScoreSchema.parse(output);
    await persistRubricFinding({ qaRunId, checkCode: "QA-IA-002", rubric, titlePrefix: "Score de originalidad IA" });
  },
  domainSchema: undefined,
  promptVersion: SCORE_ORIGINALITY_PROMPT_VERSION,
};

// ─── detect_ai_likeness (QA-IA-003) ────────────────────────────────────────

export const detectAiLikenessOperation = {
  loadExtra: loadAdvisoryContext,
  guard: makeGuard("likenessRunId", "La detección de semejanza IA"),
  buildRequest: (full: PixelforgeProjectFull, ctx: AdvisoryOperationCtx, extra: unknown) => {
    void full;
    void ctx;
    const { pageVersion } = extra as LoadedAdvisoryContext;
    return buildDetectAiLikenessRequest({ tree: resolveValidatedTree(pageVersion) });
  },
  inputSummary: (full: PixelforgeProjectFull, ctx: AdvisoryOperationCtx, extra: unknown) => {
    void full;
    void ctx;
    const loaded = extra as LoadedAdvisoryContext | null;
    return { nodeCount: loaded ? countValidatedNodes(loaded.pageVersion) : 0 };
  },
  resultRef: (ctx: AdvisoryOperationCtx) => `qa_run:${ctx.qaRunId}`,
  persistResult: async (output: unknown, ctx: AdvisoryOperationCtx) => {
    const qaRunId = requireQaRunId(ctx, "detect_ai_likeness");
    const likeness = aiLikenessSchema.parse(output);
    await persistLikenessFindings(qaRunId, likeness);
  },
  domainSchema: undefined,
  promptVersion: DETECT_AI_LIKENESS_PROMPT_VERSION,
};
