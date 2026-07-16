/**
 * Schema del artifact `direction_decision` — la ELECCIÓN humana de una
 * dirección creativa (no un output de IA: lo escribe `chooseDirectionAction`,
 * F5-T3+). Vive junto al resto de `schemas/` porque comparte convención
 * (`zod/v4`, `.describe()` para futura reutilización) aunque no pase por
 * Structured Outputs.
 *
 * Forma del plan maestro: quién se eligió, por qué (mínimo 10 caracteres —
 * "porque sí" no es una razón auditable), qué riesgos se aceptan
 * conscientemente al elegirla, y de qué direcciones se combinó si la
 * elección fue una mezcla de más de una.
 */
import { z } from "zod/v4";

export const directionDecisionSchema = z.object({
  chosenDirectionId: z.uuid().describe("Id de la dirección creativa elegida (fila de pixelforge_creative_directions)."),
  rationale: z.string().min(10).describe("Por qué se eligió esta dirección — razón auditable, no una frase vacía."),
  acceptedRisks: z.array(z.string().min(1)).describe("Riesgos de la dirección elegida que se aceptan conscientemente."),
  combinedFromDirectionIds: z
    .array(z.uuid())
    .describe("Ids de otras direcciones de las que se tomaron elementos, si la elección combinó más de una."),
});
export type DirectionDecision = z.infer<typeof directionDecisionSchema>;
