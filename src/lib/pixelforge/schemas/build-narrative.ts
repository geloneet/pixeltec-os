/**
 * Schema de salida de `build_narrative` — v1 estructural (F6 la usa e2e).
 * El superRefine se aplica directamente sobre el schema registrado (a
 * diferencia de analyze-context, aquí no hay una fase de F2 e2e que
 * dependa de separar forma/dominio): `actos[].orden` debe ser consecutivo
 * desde 1 y `cinematicMoments[].actoOrden` debe existir en `actos`.
 */
import { z } from "zod";

const actoSchema = z.object({
  orden: z.number().int(),
  proposito: z.string().min(1),
  mensaje: z.string().min(1),
  tension: z.string().min(1),
  resolucion: z.string().min(1),
});

const cinematicMomentSchema = z.object({
  actoOrden: z.number().int(),
  descripcion: z.string().min(1),
  motifConnection: z.string().min(1).describe("Relación explícita con el Signature Motif de la dirección elegida."),
});

export const narrativeBlueprintSchema = z
  .object({
    historia: z.string().min(1),
    actos: z.array(actoSchema).min(3).max(8),
    cinematicMoments: z
      .array(cinematicMomentSchema)
      .max(3)
      .describe("Momentos cinematográficos ligados al motif — máximo 3."),
    notasProduccion: z.array(z.string().min(1)),
  })
  .superRefine((blueprint, ctx) => {
    blueprint.actos.forEach((acto, i) => {
      if (acto.orden !== i + 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["actos", i, "orden"],
          message: `El acto en la posición ${i} debe tener orden=${i + 1} (consecutivo desde 1), recibido ${acto.orden}.`,
        });
      }
    });
    const ordenesActos = new Set(blueprint.actos.map((a) => a.orden));
    blueprint.cinematicMoments.forEach((moment, i) => {
      if (!ordenesActos.has(moment.actoOrden)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cinematicMoments", i, "actoOrden"],
          message: `cinematicMoments[${i}].actoOrden=${moment.actoOrden} no corresponde a ningún acto existente.`,
        });
      }
    });
  });
export type NarrativeBlueprint = z.infer<typeof narrativeBlueprintSchema>;
