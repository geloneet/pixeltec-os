/**
 * Validación zod del pipeline de Definición de Proyecto.
 */
import { z } from "zod";
import { STATION_SEQUENCE } from "@/lib/definition/types";

export const stationSchema = z.enum(STATION_SEQUENCE);

/** Body de POST /api/definition/generate. */
export const generateRequestSchema = z.object({
  definitionId: z.string().uuid(),
  station: stationSchema,
  // Ausente => primera generación (auto-kickoff). Presente => iteración.
  userMessage: z.string().trim().min(1).max(8000).optional(),
});
export type GenerateRequest = z.infer<typeof generateRequestSchema>;

/** Input de la descarga mental al crear una definición. */
export const createDefinitionSchema = z.object({
  clientCrmId: z.string().trim().min(1, "Falta el cliente"),
  brainDump: z
    .string()
    .trim()
    .min(20, "Escribe al menos un par de frases para que la IA tenga con qué trabajar")
    .max(20000),
});
export type CreateDefinitionInputSchema = z.infer<typeof createDefinitionSchema>;

export const reopenSchema = z.object({
  definitionId: z.string().uuid(),
  station: stationSchema,
  reason: z.string().trim().min(3, "Explica brevemente por qué reabres la estación").max(1000),
});
