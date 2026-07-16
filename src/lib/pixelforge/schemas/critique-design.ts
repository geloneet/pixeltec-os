/**
 * `rubricSchema` — shape de rúbrica compartido por las 3 operaciones de QA
 * (critique_design, score_originality, detect_ai_likeness). Se define aquí
 * y se reexporta/extiende desde score-originality.ts y detect-ai-likeness.ts
 * para que las 3 operaciones evolucionen juntas.
 */
import { z } from "zod/v4";

const criterioSchema = z.object({
  nombre: z.string().min(1),
  score: z.number().int().min(0).max(100),
  reasons: z.array(z.string().min(1)).min(1),
  warnings: z.array(z.string().min(1)),
  confidence: z.enum(["baja", "media", "alta"]),
});
export type Criterio = z.infer<typeof criterioSchema>;

export const rubricSchema = z.object({
  score: z.number().int().min(0).max(100),
  veredicto: z.string().min(1),
  criteria: z.array(criterioSchema).min(3),
});
export type Rubric = z.infer<typeof rubricSchema>;

export const designCritiqueSchema = rubricSchema.describe(
  "Crítica de diseño: evalúa la propuesta de página contra criterios de diseño profesional (jerarquía visual, composición, tipografía, coherencia con el Signature Motif de la dirección elegida)."
);
export type DesignCritique = z.infer<typeof designCritiqueSchema>;
