/**
 * Schema de salida de `compose_page_tree` — v1 estructural (F7 la usa e2e).
 * `propsJson` es un string: la validación real contra el `propsSchema` de
 * cada componente del registry ocurre en `validatePageTree` (F6/F7), NO
 * aquí — este schema solo garantiza la forma del árbol y la coreografía.
 * El superRefine (nodeIds únicos) se aplica directamente sobre el schema
 * registrado, igual que build-narrative.
 */
import { z } from "zod";

const motionSequenceSchema = z.object({
  behaviorId: z.string().min(1).describe("Id de un comportamiento de motion REGISTRADO en el registry de behaviors seguros."),
  targetSlot: z.string().min(1).describe("Slot del componente objetivo — debe existir en motionSlots/editableSlots del componente."),
  trigger: z.enum(["load", "in-view", "interaction", "scroll-progress"]),
  order: z.number().int(),
  durationToken: z.enum(["fast", "normal", "slow"]),
  delayStrategy: z.enum(["none", "index", "distance", "semantic"]),
  intensity: z.number().int().min(1).max(3),
});

const choreographySchema = z.object({
  narrativePurpose: z.string().min(1),
  motifConnection: z
    .string()
    .min(1)
    .describe("Relación explícita con el Signature Motif — evita el 'fade-up en todo' genérico."),
  sequences: z.array(motionSequenceSchema),
  reducedMotionFallback: z.string().min(1),
});

const pageNodeSchema = z.object({
  nodeId: z.string().min(1),
  componentId: z.string().min(1),
  variant: z.string().min(1),
  orden: z.number().int(),
  propsJson: z
    .string()
    .describe(
      "Props del componente serializadas como JSON string. La validación real contra el propsSchema del registry ocurre en validatePageTree (F6/F7), NO aquí."
    ),
  choreography: choreographySchema.optional(),
});

export const pageTreeSchema = z
  .object({
    nodes: z.array(pageNodeSchema).min(3),
    notas: z.string(),
  })
  .superRefine((tree, ctx) => {
    const seen = new Set<string>();
    tree.nodes.forEach((node, i) => {
      if (seen.has(node.nodeId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["nodes", i, "nodeId"],
          message: `nodeId "${node.nodeId}" duplicado — cada nodo del árbol debe tener un nodeId único.`,
        });
      }
      seen.add(node.nodeId);
    });
  });
export type PageTree = z.infer<typeof pageTreeSchema>;
