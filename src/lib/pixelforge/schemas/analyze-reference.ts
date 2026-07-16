/**
 * Schema de salida de `analyze_reference` — v1 estructural (F4 la usa e2e).
 * SOLO enums cerrados de atributos abstractos: la defensa real contra
 * prompt injection en contenido de terceros (URLs/imágenes) es que este
 * schema no tiene ningún canal de salida de texto libre más allá de `notas`.
 */
import { z } from "zod";

export const referenceAnalysisSchema = z
  .object({
    densidadVisual: z.enum(["minimal", "moderada", "densa"]),
    paletaDominante: z.enum(["clara", "oscura", "alto-contraste", "monocroma", "colorida"]),
    temperatura: z.enum(["fria", "neutra", "calida"]),
    tipografiaTitulos: z.enum(["serif", "sans-serif", "display", "mono"]),
    estiloLayout: z.enum(["editorial", "grid", "asimetrico", "clasico", "experimental"]),
    nivelMovimientoPercibido: z.enum(["estatico", "sutil", "moderado", "alto"]),
    personalidad: z
      .array(z.enum(["premium", "tecnica", "cercana", "corporativa", "juvenil", "artesanal", "audaz", "sobria"]))
      .min(1)
      .max(3),
    notas: z.string(),
  })
  .describe(
    "Análisis de una referencia visual usando SOLO enums cerrados de atributos abstractos — nunca colores/textos libres extraídos del sitio de terceros."
  );
export type ReferenceAnalysis = z.infer<typeof referenceAnalysisSchema>;
