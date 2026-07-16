/**
 * Schema de salida de `score_originality` — v1 estructural (F8 la usa e2e).
 * Comparte el shape de `rubricSchema` (ver critique-design.ts).
 */
import type { z } from "zod/v4";
import { rubricSchema } from "./critique-design";

export const originalityScoreSchema = rubricSchema.describe(
  "Puntaje de originalidad: qué tan distintiva es la landing frente a plantillas genéricas de IA."
);
export type OriginalityScore = z.infer<typeof originalityScoreSchema>;
