/**
 * Schema de salida de `synthesize_visual_dna` — v1 estructural (F4 la usa e2e).
 */
import { z } from "zod";

export const visualDnaSchema = z.object({
  direccionGeneral: z.string().min(1),
  paleta: z.object({
    estrategia: z.string().min(1),
    contraste: z.enum(["suave", "medio", "alto"]),
  }),
  tipografia: z.object({
    caracterTitulos: z.string().min(1),
    caracterCuerpo: z.string().min(1),
  }),
  espaciado: z.enum(["compacto", "equilibrado", "aireado"]),
  motivosVisuales: z.array(z.string().min(1)).min(1).max(5),
  antiPatrones: z.array(z.string().min(1)).describe("Qué evitar explícitamente para no parecer plantilla genérica de IA."),
  influencias: z.array(
    z.object({
      referenceId: z.string().min(1),
      peso: z.enum(["baja", "media", "alta"]),
      queTomar: z.string().min(1),
    })
  ),
});
export type VisualDna = z.infer<typeof visualDnaSchema>;
