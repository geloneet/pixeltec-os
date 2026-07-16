/**
 * Schema de salida de `analyze_context` — el único de las 11 operaciones que
 * F2 usa e2e (las demás son v1 estructurales, ver resto de este directorio).
 *
 * `contextBriefSchema` es la FORMA que la API de Structured Outputs garantiza
 * (se registra tal cual en `OPERATION_SPECS`, sin refines, para que
 * `zodOutputFormat` genere un JSON Schema limpio). `contextBriefDomainSchema`
 * añade los refines de DOMINIO (relaciones entre campos) que Structured
 * Outputs no puede expresar — son los que disparan el retry semántico en
 * `ai/run.ts` (F2-T3), aplicados sobre el resultado YA parseado.
 */
import { z } from "zod/v4";

/** Referencia a la fuente real que sustenta un ítem — anti-invención. */
export const evidenciaSchema = z.object({
  sourceRef: z
    .string()
    .min(1)
    .describe('Id de la fuente que sustenta el ítem ("source:<uuid>") o "braindump" si viene del volcado inicial.'),
  cita: z.string().min(1).describe("Fragmento textual literal de la fuente que sustenta el ítem."),
});
export type Evidencia = z.infer<typeof evidenciaSchema>;

const briefItemSchema = z.object({
  titulo: z.string().min(1),
  detalle: z.string().min(1),
  confianza: z.enum(["baja", "media", "alta"]).describe("Nivel de confianza del análisis."),
  evidencias: z.array(evidenciaSchema),
});
export type BriefItem = z.infer<typeof briefItemSchema>;

export const contextBriefSchema = z.object({
  confirmados: z.array(briefItemSchema).describe("Hechos confirmados explícitamente por el brainDump o las fuentes."),
  inferidos: z.array(briefItemSchema).describe("Hechos razonablemente inferidos, sin confirmación explícita."),
  faltantes: z
    .array(briefItemSchema)
    .describe("Información relevante que NO está presente en ninguna fuente (por definición, sin evidencias)."),
  contradicciones: z.array(briefItemSchema).describe("Puntos donde las fuentes se contradicen entre sí."),
  resumen: z.string().min(1).describe("Resumen de 2 a 4 frases del proyecto."),
});
export type ContextBrief = z.infer<typeof contextBriefSchema>;

/**
 * Refines de DOMINIO — NO se registran en `OPERATION_SPECS` (esa entrada usa
 * `contextBriefSchema` a secas). Se aplican en un segundo paso, después de
 * que Structured Outputs ya garantizó la forma:
 * - `confirmados`, `inferidos` y `contradicciones`: todo ítem requiere ≥1
 *   evidencia (el prompt ya lo pide para los tres — esto solo alinea el
 *   schema; un "inferido" sin evidencia es indistinguible de una invención).
 * - `faltantes`: NO debe tener evidencias (si hay evidencia, no "falta").
 * - Debe haber al menos 1 ítem en total entre las 4 listas.
 */
export const contextBriefDomainSchema = contextBriefSchema.superRefine((brief, ctx) => {
  brief.confirmados.forEach((item, i) => {
    if (item.evidencias.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmados", i, "evidencias"],
        message: `El ítem confirmado "${item.titulo}" no tiene evidencias.`,
      });
    }
  });
  brief.inferidos.forEach((item, i) => {
    if (item.evidencias.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["inferidos", i, "evidencias"],
        message: `El ítem inferido "${item.titulo}" no tiene evidencias.`,
      });
    }
  });
  brief.contradicciones.forEach((item, i) => {
    if (item.evidencias.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["contradicciones", i, "evidencias"],
        message: `La contradicción "${item.titulo}" no tiene evidencias.`,
      });
    }
  });
  brief.faltantes.forEach((item, i) => {
    if (item.evidencias.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["faltantes", i, "evidencias"],
        message: `El ítem faltante "${item.titulo}" tiene evidencias: si hay evidencia, no está faltando.`,
      });
    }
  });
  const total =
    brief.confirmados.length + brief.inferidos.length + brief.faltantes.length + brief.contradicciones.length;
  if (total === 0) {
    ctx.addIssue({
      code: "custom",
      path: [],
      message: "El brief no tiene ningún ítem en confirmados/inferidos/faltantes/contradicciones.",
    });
  }
});
