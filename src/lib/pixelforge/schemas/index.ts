/**
 * Registro central de las 11 operaciones IA de PixelForge. Zod es la única
 * fuente de verdad de los outputs (Structured Outputs vía `zodOutputFormat`
 * en la capa `ai/` — F2-T3): cada `outputSchema` de aquí es lo que se envía
 * a `client.messages.parse({ output_config: { format: zodOutputFormat(...) } })`.
 *
 * Nota sobre `analyze_context`: aquí se registra `contextBriefSchema` (la
 * FORMA, sin refines de dominio) — `contextBriefDomainSchema` (con los
 * refines) vive en `analyze-context.ts` y se aplica aparte, después del
 * parseo, en `ai/run.ts`.
 */
import type { z } from "zod";
import { contextBriefSchema } from "./analyze-context";
import { landingDnaSchema } from "./generate-strategy";
import { referenceAnalysisSchema } from "./analyze-reference";
import { visualDnaSchema } from "./synthesize-visual-dna";
import { creativeDirectionsSchema } from "./generate-directions";
import { narrativeBlueprintSchema } from "./build-narrative";
import { pageTreeSchema } from "./compose-page-tree";
import { proposedChangeSchema } from "./propose-change";
import { designCritiqueSchema } from "./critique-design";
import { originalityScoreSchema } from "./score-originality";
import { aiLikenessSchema } from "./detect-ai-likeness";

export const PIXELFORGE_AI_OPERATIONS = [
  "analyze_context",
  "generate_strategy",
  "analyze_reference",
  "synthesize_visual_dna",
  "generate_directions",
  "build_narrative",
  "compose_page_tree",
  "propose_change",
  "critique_design",
  "score_originality",
  "detect_ai_likeness",
] as const;
export type PixelforgeAIOperation = (typeof PIXELFORGE_AI_OPERATIONS)[number];

export interface OperationSpec {
  outputSchema: z.ZodTypeAny;
  promptVersion: string;
  maxTokens: number;
}

export const OPERATION_SPECS: Record<PixelforgeAIOperation, OperationSpec> = {
  analyze_context: { outputSchema: contextBriefSchema, promptVersion: "v1", maxTokens: 8000 },
  generate_strategy: { outputSchema: landingDnaSchema, promptVersion: "v1", maxTokens: 8000 },
  analyze_reference: { outputSchema: referenceAnalysisSchema, promptVersion: "v1", maxTokens: 4000 },
  synthesize_visual_dna: { outputSchema: visualDnaSchema, promptVersion: "v1", maxTokens: 6000 },
  generate_directions: { outputSchema: creativeDirectionsSchema, promptVersion: "v1", maxTokens: 12000 },
  build_narrative: { outputSchema: narrativeBlueprintSchema, promptVersion: "v1", maxTokens: 8000 },
  compose_page_tree: { outputSchema: pageTreeSchema, promptVersion: "v1", maxTokens: 16000 },
  propose_change: { outputSchema: proposedChangeSchema, promptVersion: "v1", maxTokens: 8000 },
  critique_design: { outputSchema: designCritiqueSchema, promptVersion: "v1", maxTokens: 8000 },
  score_originality: { outputSchema: originalityScoreSchema, promptVersion: "v1", maxTokens: 6000 },
  detect_ai_likeness: { outputSchema: aiLikenessSchema, promptVersion: "v1", maxTokens: 6000 },
};
