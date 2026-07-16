/**
 * Schema de salida de `generate_strategy` — v1 estructural (F3 la usa e2e).
 * Reutiliza `evidenciaSchema` de analyze-context: cada mensaje clave y el
 * ADN de landing en general deben rastrearse a una fuente real
 * (anti-invención, mismo patrón que el Context Brief).
 */
import { z } from "zod/v4";
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

/**
 * Refines de DOMINIO — NO se registran en `OPERATION_SPECS` (esa entrada usa
 * `landingDnaSchema` a secas). Se aplican en un segundo paso, después de que
 * Structured Outputs ya garantizó la forma (mismo patrón que
 * `contextBriefDomainSchema` en `analyze-context.ts`):
 * - `mensajesClave`: cada ítem requiere ≥1 evidencia (la gramática NO
 *   garantiza `.min()` de un array anidado — igual que `confirmados`/
 *   `inferidos`/`contradicciones` del Context Brief).
 * - `evidencias` (las globales): re-chequeado a mano por la misma razón,
 *   aunque el schema base ya declara `.min(1)` — el `minItems` de la
 *   gramática puede degradarse (ver docstring de `ai/run.ts`, hallazgo C1).
 * - `llamadosAccion`: sin textos duplicados (case-insensitive, trim) — dos
 *   CTAs "iguales" no aportan nada distinto a la landing.
 */
export const landingDnaDomainSchema = landingDnaSchema.superRefine((dna, ctx) => {
  dna.mensajesClave.forEach((item, i) => {
    if (item.evidencias.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["mensajesClave", i, "evidencias"],
        message: `El mensaje clave "${item.mensaje}" no tiene evidencias.`,
      });
    }
  });

  if (dna.evidencias.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["evidencias"],
      message: "El Landing DNA no tiene evidencias globales que lo sustenten.",
    });
  }

  const seenCtas = new Set<string>();
  dna.llamadosAccion.forEach((cta, i) => {
    const key = cta.texto.trim().toLowerCase();
    if (seenCtas.has(key)) {
      ctx.addIssue({
        code: "custom",
        path: ["llamadosAccion", i, "texto"],
        message: `El llamado a la acción "${cta.texto}" está duplicado.`,
      });
    } else {
      seenCtas.add(key);
    }
  });
});
