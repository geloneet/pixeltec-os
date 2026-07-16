/**
 * Schema de salida de `detect_ai_likeness` — v1 estructural (F8 la usa e2e).
 * Extiende `rubricSchema` (ver critique-design.ts) con `senalesDetectadas`.
 */
import { z } from "zod";
import { rubricSchema } from "./critique-design";

export const aiLikenessSchema = rubricSchema
  .extend({
    senalesDetectadas: z
      .array(z.string().min(1))
      .describe(
        "Señales concretas que delatan generación por IA (ritmo genérico, 'fade-up en todo', motifs sin conexión narrativa, etc.)."
      ),
  })
  .describe("Detección de 'olor a IA': qué tan probable es que un visitante identifique la landing como generada por IA.");
export type AiLikeness = z.infer<typeof aiLikenessSchema>;
