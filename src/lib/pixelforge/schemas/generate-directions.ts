/**
 * Schema de salida de `generate_directions` — F5 la usa e2e.
 *
 * `creativeDirectionsSchema` es la FORMA que Structured Outputs garantiza
 * (se registra tal cual en `OPERATION_SPECS`, sin refines): el contenedor
 * acepta de 1 a 3 direcciones (`min(1).max(3)`, NO `.length(3)` — decisión de
 * diseño F5 #3) porque el mismo shape sirve tanto para la generación completa
 * (3 direcciones) como para la regeneración de un solo slot (1 dirección). La
 * exactitud por MODO de request (3 con slots {1,2,3} sin repetir vs. 1 con el
 * slot pedido) es un refine de DOMINIO — no lo puede expresar la gramática de
 * Structured Outputs — aplicado después del parseo vía
 * `buildCreativeDirectionsDomainSchema(opts)` (mismo patrón que
 * `contextBriefDomainSchema`/`landingDnaDomainSchema`, pero como FUNCIÓN:
 * el refine depende del modo de la request, no es un valor fijo).
 *
 * `signatureComponent` es la única unión real del módulo: o referencia una
 * capability certificada del Signature Capability Registry
 * (`src/lib/pixelforge/registry/capabilities.ts`), o declara honestamente
 * que requiere desarrollo custom — PixelForge nunca finge originalidad con
 * un contenedor vacío. Que el `capabilityId` exista de verdad en el registro
 * también es un refine de dominio (el registro es data en TS, no algo que
 * Structured Outputs pueda validar por sí solo).
 */
import { z } from "zod/v4";
import { CAPABILITY_IDS } from "../registry/capabilities";

const tokenPaletaSchema = z.object({
  token: z.string().min(1).describe("Nombre semántico del token (ej. 'color-primario', 'color-acento')."),
  valor: z.string().min(1).describe("Valor del token (hex, gradiente, o descripción operable)."),
  uso: z.string().min(1).describe("Dónde y cómo se usa este token en la landing."),
});

const designTokensSchema = z.object({
  paleta: z
    .array(tokenPaletaSchema)
    .min(3)
    .max(8)
    .describe("Entre 3 y 8 tokens de color con su uso explícito — no una paleta genérica sin propósito."),
  tipografia: z.object({
    display: z.string().min(1).describe("Familia tipográfica para títulos/display."),
    body: z.string().min(1).describe("Familia tipográfica para cuerpo de texto."),
    escala: z.string().min(1).describe("Descripción de la escala tipográfica (ej. 'modular 1.25, base 16px')."),
  }),
  radios: z.enum(["rectos", "suaves", "redondeados"]),
  espaciado: z.enum(["compacto", "equilibrado", "aireado"]),
  sombra: z.enum(["ninguna", "sutil", "pronunciada"]).optional().describe("Tratamiento de sombra, si la dirección lo usa."),
});

const motionDnaSchema = z.object({
  personalidad: z.string().min(1).describe("Personalidad del movimiento en una frase (ej. 'preciso y mecánico')."),
  ritmo: z.enum(["lento", "moderado", "rapido"]).describe("Ritmo general de las animaciones de esta dirección."),
  intensidadGlobal: z
    .union([z.literal(1), z.literal(2), z.literal(3)])
    .describe("Intensidad global del movimiento: 1=sutil, 2=moderada, 3=marcada."),
  firmas: z
    .array(z.string().min(1))
    .min(1)
    .max(3)
    .describe("De 1 a 3 firmas de movimiento reconocibles, propias de esta dirección."),
});

const signatureMotifSchema = z.object({
  nombre: z.string().min(1),
  descripcion: z.string().min(1),
  aplicaciones: z
    .array(z.string().min(1))
    .min(2)
    .max(5)
    .describe("De 2 a 5 lugares concretos de la landing donde aparece el motif."),
});

const signatureComponentSchema = z
  .discriminatedUnion("status", [
    z.object({
      status: z.literal("capability"),
      capabilityId: z.string().min(1).describe("Id de una capability certificada del Signature Capability Registry."),
      concepto: z.string().min(1).describe("Cómo esta capability expresa el concepto único de esta dirección."),
      configuracionInicial: z.string().min(1).describe("Configuración inicial propuesta para la capability en esta landing."),
      datosRequeridos: z
        .array(z.string().min(1))
        .describe("Datos del proyecto/cliente que la capability necesita para funcionar."),
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
  );

const scoresSchema = z.object({
  originalidadConceptual: z.number().int().min(0).max(100),
  independenciaDeReferencias: z.number().int().min(0).max(100),
  especificidadDelMotif: z.number().int().min(0).max(100),
  utilidadDelSignature: z.number().int().min(0).max(100),
  riesgoGenericidadIA: z.number().int().min(0).max(100).describe("0=nada genérico, 100=indistinguible de una plantilla de IA."),
});

const scoresRazonesSchema = z.object({
  porCriterio: z.string().min(1).describe("Explicación en prosa de por qué cada criterio de `scores` recibió su puntaje."),
});

const direccionSchema = z.object({
  slot: z.number().int().min(1).max(3),
  title: z.string().min(1),
  concept: z.string().min(1),
  designTokens: designTokensSchema,
  motionDna: motionDnaSchema,
  signatureMotif: signatureMotifSchema,
  signatureComponent: signatureComponentSchema,
  scores: scoresSchema,
  scoresRazones: scoresRazonesSchema,
  risks: z.array(z.string().min(1)).max(4).describe("Riesgos de esta dirección (0 a 4) — vacío si no hay ninguno relevante."),
});
export type Direccion = z.infer<typeof direccionSchema>;

export const creativeDirectionsSchema = z.object({
  direcciones: z
    .array(direccionSchema)
    .min(1)
    .max(3)
    .describe(
      "1 a 3 direcciones creativas: 3 en generación completa (slots 1-3), 1 en regeneración de un solo slot."
    ),
});
export type CreativeDirections = z.infer<typeof creativeDirectionsSchema>;

/** Opciones de `buildCreativeDirectionsDomainSchema` — un modo por request, nunca por datos del proyecto. */
export type CreativeDirectionsDomainOptions = { mode: "full" } | { mode: "slot"; slot: number };

/**
 * Refines de DOMINIO — NO se registran en `OPERATION_SPECS` (esa entrada usa
 * `creativeDirectionsSchema` a secas). A diferencia de `contextBriefDomainSchema`/
 * `landingDnaDomainSchema` (un valor fijo), este es una FUNCIÓN: el refine
 * correcto depende del MODO de la request (generación completa vs.
 * regeneración de un slot), resuelto por el route antes de llamar
 * `executeOperation` (decisión de diseño F5 #3). Sigue siendo un set finito
 * y estático de 2 formas — nada dinámico por datos del proyecto.
 *
 * Comunes a ambos modos:
 * - `signatureComponent.status === "capability"` → `capabilityId` debe existir
 *   en `CAPABILITY_IDS` (el Signature Capability Registry).
 * - `title` únicos entre las direcciones de la respuesta (case-insensitive,
 *   trim) — dos direcciones "iguales" no son 3 opciones reales.
 *
 * Modo `full` (generación completa):
 * - Exactamente 3 direcciones.
 * - `slot` cubre {1,2,3} sin repetir.
 *
 * Modo `slot` (regeneración de un slot):
 * - Exactamente 1 dirección.
 * - Su `slot` es el pedido (`opts.slot`).
 */
export function buildCreativeDirectionsDomainSchema(opts: CreativeDirectionsDomainOptions) {
  return creativeDirectionsSchema.superRefine((data, ctx) => {
    data.direcciones.forEach((direccion, i) => {
      if (
        direccion.signatureComponent.status === "capability" &&
        !(CAPABILITY_IDS as string[]).includes(direccion.signatureComponent.capabilityId)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["direcciones", i, "signatureComponent", "capabilityId"],
          message: `capabilityId "${direccion.signatureComponent.capabilityId}" no existe en el Signature Capability Registry.`,
        });
      }
    });

    const seenTitles = new Set<string>();
    data.direcciones.forEach((direccion, i) => {
      const key = direccion.title.trim().toLowerCase();
      if (seenTitles.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["direcciones", i, "title"],
          message: `El título "${direccion.title}" está duplicado entre las direcciones.`,
        });
      } else {
        seenTitles.add(key);
      }
    });

    if (opts.mode === "full") {
      if (data.direcciones.length !== 3) {
        ctx.addIssue({
          code: "custom",
          path: ["direcciones"],
          message: `La generación completa exige exactamente 3 direcciones, recibidas ${data.direcciones.length}.`,
        });
      }
      const seenSlots = new Set<number>();
      data.direcciones.forEach((direccion, i) => {
        if (seenSlots.has(direccion.slot)) {
          ctx.addIssue({
            code: "custom",
            path: ["direcciones", i, "slot"],
            message: `El slot ${direccion.slot} está repetido — se esperan los slots 1, 2 y 3 sin repetir.`,
          });
        } else {
          seenSlots.add(direccion.slot);
        }
      });
    } else {
      if (data.direcciones.length !== 1) {
        ctx.addIssue({
          code: "custom",
          path: ["direcciones"],
          message: `La regeneración de un slot exige exactamente 1 dirección, recibidas ${data.direcciones.length}.`,
        });
      } else if (data.direcciones[0].slot !== opts.slot) {
        ctx.addIssue({
          code: "custom",
          path: ["direcciones", 0, "slot"],
          message: `Se esperaba el slot ${opts.slot}, recibido ${data.direcciones[0].slot}.`,
        });
      }
    }
  });
}
