/**
 * Schema de salida de `propose_change` — v1 estructural (F7 la usa e2e).
 * `before`/`after` se dejan como string libre (sin `.min(1)`): operaciones
 * como "add-after" no tienen `before` previo y "remove" no tiene `after`.
 */
import { z } from "zod/v4";

export const proposedChangeSchema = z.object({
  resumen: z.string().min(1),
  changes: z
    .array(
      z.object({
        nodeId: z.string().min(1),
        op: z.enum(["update-copy", "update-props", "reorder", "replace-variant", "remove", "add-after"]),
        before: z.string(),
        after: z.string(),
        razon: z.string().min(1),
      })
    )
    .min(1),
});
export type ProposedChange = z.infer<typeof proposedChangeSchema>;
