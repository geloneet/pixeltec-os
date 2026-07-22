/**
 * `runDeterministicChecks` — orquestador del núcleo puro de QA (PF-F8 T2).
 * Corre TODOS los checks `det`/`heu` ejecutables server-side sobre un árbol
 * + la dirección `chosen` (o su ausencia). Nunca lanza: cualquier check que
 * no pueda evaluarse (árbol inválido para los que necesitan nodos validados,
 * `designTokens` malformados para los de diseño) se reporta en
 * `checksSkipped`, jamás como excepción — T4 (API) llama a esta función
 * directamente sobre el `tree`/`chosenDirection` que lee de DB, sin try/catch
 * propio.
 */
import { validatePageTree } from "@/lib/pixelforge/registry/validate-page-tree";
import type { DesignTokens } from "@/components/pixelforge/render/tokens";
import { checkST001, checkST002, checkST003 } from "./checks/structural";
import { checkDesignTokens, checkNoChosenDirection } from "./checks/design";
import { checkVI008, checkVI009, checkMO004, checkMO006, checkCA001, checkCA005, checkTE009 } from "./checks/heuristics";
import type { QaFindingInput } from "./catalog";

export interface DeterministicChecksInput {
  /** El jsonb crudo de `page_versions.tree` — sin validar todavía. */
  tree: unknown;
  /** `null` si el proyecto no tiene una dirección `chosen` vigente. */
  chosenDirection: {
    /** Lo que consume `directionTokensToCssVars` — forma esperada `DesignTokens`, pero llega `unknown` (columna jsonb). */
    designTokens: unknown;
    status: string;
  } | null;
}

export interface DeterministicChecksResult {
  findings: QaFindingInput[];
  /** Códigos DET/HEU no ejecutables (p.ej. árbol inválido, o designTokens malformados) — nunca se lanza una excepción en su lugar. */
  checksSkipped: string[];
}

/** Checks que requieren el árbol YA validado (nodos con `orden`/`componentId`/`props` resueltos) — se saltan si `validatePageTree` falla. */
const TREE_DEPENDENT_CHECK_CODES = [
  "QA-ST-002",
  "QA-ST-003",
  "QA-VI-008",
  "QA-VI-009",
  "QA-MO-004",
  "QA-MO-006",
  "QA-CA-001",
  "QA-CA-005",
  "QA-TE-009",
] as const;

/** Checks que requieren `designTokens` de una dirección `chosen` — se saltan si no hay dirección elegida, o si sus `designTokens` no tienen la forma esperada. */
const DESIGN_TOKEN_CHECK_CODES = ["QA-DI-001", "QA-DI-002", "QA-DI-003", "QA-DI-004", "QA-DI-005"] as const;

export function runDeterministicChecks(input: DeterministicChecksInput): DeterministicChecksResult {
  const findings: QaFindingInput[] = [];
  const checksSkipped: string[] = [];

  const validation = validatePageTree(input.tree);

  if (!validation.ok) {
    findings.push(...checkST001(validation.errors));
    checksSkipped.push(...TREE_DEPENDENT_CHECK_CODES);
  } else {
    const tree = validation.tree;
    findings.push(
      ...checkST002(tree),
      ...checkST003(tree),
      ...checkVI008(tree),
      ...checkVI009(tree),
      ...checkMO004(tree),
      ...checkMO006(tree),
      ...checkCA001(tree),
      ...checkCA005(tree),
      ...checkTE009(tree)
    );
  }

  if (input.chosenDirection === null) {
    findings.push(checkNoChosenDirection());
    checksSkipped.push(...DESIGN_TOKEN_CHECK_CODES);
  } else {
    try {
      findings.push(...checkDesignTokens(input.chosenDirection.designTokens as DesignTokens));
    } catch {
      // `designTokens` es jsonb (unknown) — si no tiene la forma esperada
      // (p.ej. falta `paleta`/`tipografia`), los checks DI-001..005 no son
      // evaluables. Nunca se lanza: se reportan como skipped.
      checksSkipped.push(...DESIGN_TOKEN_CHECK_CODES);
    }
  }

  return { findings, checksSkipped };
}
