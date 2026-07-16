/**
 * Schema de salida de `generate_strategy` — v1 estructural (F3 la usa e2e).
 * Reutiliza `evidenciaSchema` de analyze-context: cada mensaje clave y el
 * ADN de landing en general deben rastrearse a una fuente real
 * (anti-invención, mismo patrón que el Context Brief).
 */
import { z } from "zod";
import { evidenciaSchema } from "./analyze-context";

export const landingDnaSchema = z.object({
  propuestaValor: z.string().min(1).describe("Propuesta de valor central de la landing, en una frase."),
  audiencia: z.object({
    descripcion: z.string().min(1),
    dolores: z.array(z.string().min(1)),
    objeciones: z.array(z.string().min(1)),
  }),
  tono: z.object({
    voz: z.string().min(1),
    atributos: z.array(z.string().min(1)).max(5),
  }),
  mensajesClave: z
    .array(
      z.object({
        mensaje: z.string().min(1),
        evidencias: z.array(evidenciaSchema),
      })
    )
    .min(1),
  llamadosAccion: z
    .array(
      z.object({
        texto: z.string().min(1),
        intencion: z.enum(["contacto", "cotizacion", "compra", "registro", "descarga", "agenda"]),
      })
    )
    .min(1),
  evidencias: z
    .array(evidenciaSchema)
    .min(1)
    .describe("Evidencias que sustentan el ADN de landing en general — toda afirmación debe rastrearse a una fuente."),
});
export type LandingDna = z.infer<typeof landingDnaSchema>;
