/**
 * Schema de salida de `generate_directions` — v1 estructural (F5 la usa e2e).
 * Siempre genera exactamente 3 slots (`.length(3)`, sin superRefine: el
 * propio schema lo garantiza). `signatureComponent` es la única unión real
 * del módulo: o referencia una capability certificada del Signature
 * Capability Registry, o declara honestamente que requiere desarrollo
 * custom — PixelForge nunca finge originalidad con un contenedor vacío.
 */
import { z } from "zod";

const direccionSchema = z.object({
  slot: z.number().int().min(1).max(3),
  nombre: z.string().min(1),
  concepto: z.string().min(1),
  designTokens: z.object({
    colorPrimario: z.string().min(1),
    colorFondo: z.string().min(1),
    colorAcento: z.string().min(1),
    fuenteTitulos: z.string().min(1),
    fuenteCuerpo: z.string().min(1),
    radios: z.enum(["rectos", "suaves", "redondeados"]),
    densidad: z.enum(["compacta", "media", "aireada"]),
  }),
  motionDna: z.object({
    intencion: z.string().min(1),
    energia: z.enum(["calma", "moderada", "alta"]),
    firma: z.string().min(1),
  }),
  signatureMotif: z.object({
    nombre: z.string().min(1),
    descripcion: z.string().min(1),
    aplicaciones: z.array(z.string().min(1)).min(2),
  }),
  signatureComponent: z
    .discriminatedUnion("status", [
      z.object({
        status: z.literal("capability"),
        capabilityId: z.string().min(1).describe("Id de una capability certificada del Signature Capability Registry."),
        configuracionPropuesta: z.string().min(1),
        justificacion: z.string().min(1),
      }),
      z.object({
        status: z.literal("custom-development-required"),
        concept: z.string().min(1),
        businessValue: z.string().min(1),
        requiredData: z.array(z.string().min(1)),
        estimatedComplexity: z.enum(["low", "medium", "high"]),
      }),
    ])
    .describe(
      "O referencia una capability certificada existente (status=capability) o declara honestamente que requiere desarrollo custom (status=custom-development-required) — nunca finge originalidad con un contenedor vacío."
    ),
  riesgos: z.array(z.string().min(1)),
  scores: z.object({
    originalidadConceptual: z.number().int().min(0).max(100),
    especificidadMotif: z.number().int().min(0).max(100),
    utilidadSignature: z.number().int().min(0).max(100),
    riesgoGenericidadIA: z.number().int().min(0).max(100),
  }),
});
export type Direccion = z.infer<typeof direccionSchema>;

export const creativeDirectionsSchema = z.object({
  direcciones: z.array(direccionSchema).length(3).describe("Exactamente 3 direcciones creativas (slots 1-3)."),
});
export type CreativeDirections = z.infer<typeof creativeDirectionsSchema>;
