/**
 * Schema de salida de `compose_page_tree` — v1 estructural (F7 la usa e2e).
 * `propsJson` es un string: la validación real contra el `propsSchema` de
 * cada componente del registry ocurre en `validatePageTree` (F6/F7), NO
 * aquí — este schema solo garantiza la forma del árbol y la coreografía.
 * El superRefine (nodeIds únicos) se aplica directamente sobre el schema
 * registrado, igual que build-narrative.
 *
 * `composePageTreeDomainSchema` (D2, F7-T2): wrapper de DOMINIO que ejecuta
 * `validatePageTree` (LA puerta única, `../registry/validate-page-tree`)
 * dentro de un `superRefine` y vuelca cada uno de sus `errors` como un issue
 * — así el retry `domain_validation` de `executeOperation` (`ai/run.ts`)
 * le devuelve al modelo, gratis, los errores CONCRETOS del registry
 * (componentId desconocido, variant inválida, propsJson malformado, props
 * que violan el propsSchema, targetSlot fuera de editableSlots, intensity 3
 * sin allowsCinematic, más de 3 nodos cinematográficos, orden duplicado,
 * reglas de capability) en vez de un genérico "salida inválida". Vive junto
 * a `pageTreeSchema` (no en `registry/`) siguiendo el mismo patrón que
 * `buildCreativeDirectionsDomainSchema` en `generate-directions.ts` — que ya
 * importa de `../registry/capabilities` — así que `schemas/` dependiendo de
 * `registry/` para un refine de dominio no es nuevo en este repo.
 *
 * Nota sobre el import circular aparente: `registry/validate-page-tree.ts`
 * importa `pageTreeSchema` de ESTE archivo, y este archivo importa
 * `validatePageTree` de ese módulo — es seguro porque ninguno de los dos usa
 * el import del otro en su nivel superior (module top-level), solo dentro de
 * cuerpos de función (`validatePageTree` internamente, y el callback de
 * `superRefine` acá) que corren en tiempo de parseo, no de import, cuando
 * ambos módulos ya terminaron de evaluarse.
 *
 * `checkComposerRules` (debajo, dentro de `composePageTreeDomainSchema`):
 * enforcea las reglas de SALIDA del composer que el SYSTEM_PROMPT mandata
 * pero que nada validaba ("3-14 nodos", "footer-contact al final") —
 * deliberadamente NO en `pageTreeSchema` (que debe seguir aceptando el
 * fixture de preview de 16 nodos, ver `fixtures/preview-tree.ts`).
 */
import { z } from "zod/v4";
import { validatePageTree } from "../registry/validate-page-tree";

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
          code: "custom",
          path: ["nodes", i, "nodeId"],
          message: `nodeId "${node.nodeId}" duplicado — cada nodo del árbol debe tener un nodeId único.`,
        });
      }
      seen.add(node.nodeId);
    });
  });
export type PageTree = z.infer<typeof pageTreeSchema>;

/** Máximo de nodos que el composer puede producir (regla del SYSTEM_PROMPT de `compose-page-tree.v1.ts`, no del contrato general del árbol). */
const MAX_COMPOSER_NODES = 14;

/** `componentId` que el SYSTEM_PROMPT exige como cierre obligatorio del árbol. */
const FOOTER_CONTACT_COMPONENT_ID = "footer-contact";

/**
 * Reglas específicas de SALIDA del composer ("3-14 nodos", "footer-contact al
 * final") que el SYSTEM_PROMPT de `compose-page-tree.v1.ts` mandata pero que
 * nada enforceaba — sin esto, una violación del modelo pasaba el schema y el
 * retry `domain_validation` de `executeOperation` (`ai/run.ts`) nunca se
 * disparaba. Viven AQUÍ (en el domain schema del composer) y NO en
 * `pageTreeSchema`/`validatePageTree`: son reglas de este output concreto,
 * no del contrato general del árbol — que otros consumidores (p.ej. el
 * fixture de preview en `fixtures/preview-tree.ts`, con 16 nodos, validado
 * directamente por `validatePageTree` en runtime, no por este domain schema)
 * siguen necesitando aceptar sin el límite de 14 nodos.
 */
function checkComposerRules(tree: PageTree, ctx: z.RefinementCtx): void {
  if (tree.nodes.length > MAX_COMPOSER_NODES) {
    ctx.addIssue({
      code: "custom",
      path: ["nodes"],
      message: `El árbol del composer no puede exceder 14 nodos (tiene ${tree.nodes.length})`,
    });
  }

  const footerNodes = tree.nodes.filter((node) => node.componentId === FOOTER_CONTACT_COMPONENT_ID);

  if (footerNodes.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["nodes"],
      message: "El árbol debe cerrar con un nodo footer-contact",
    });
  } else if (footerNodes.length > 1) {
    ctx.addIssue({
      code: "custom",
      path: ["nodes"],
      message: `Solo puede haber un nodo footer-contact en el árbol (hay ${footerNodes.length})`,
    });
  } else {
    const maxOrden = Math.max(...tree.nodes.map((node) => node.orden));
    if (footerNodes[0]?.orden !== maxOrden) {
      ctx.addIssue({
        code: "custom",
        path: ["nodes"],
        message: "footer-contact debe ser el último nodo (orden más alto)",
      });
    }
  }
}

/**
 * Wrapper de dominio (D2) — parsea con `pageTreeSchema` (forma, incluido el
 * superRefine de `nodeId` únicos de arriba) y, si eso pasa, corre
 * `validatePageTree` sobre el árbol ya parseado (re-ejecuta
 * `pageTreeSchema.safeParse` internamente — idempotente, el árbol ya es
 * válido en forma) y vuelca cada string de `errors` como un issue de zod.
 * `executeOperation` llama `domainSchema.safeParse(json)` con el JSON crudo
 * de la respuesta del modelo (`ai/run.ts`) — nunca con el resultado ya
 * parseado por `outputSchema` — así que este wrapper debe (y puede) volver a
 * parsear la forma desde cero, exactamente como hace
 * `buildCreativeDirectionsDomainSchema`. También corre `checkComposerRules`
 * (arriba) para las reglas de "3-14 nodos"/"footer-contact al final" propias
 * de este output.
 */
export const composePageTreeDomainSchema = pageTreeSchema.superRefine((tree, ctx) => {
  const validation = validatePageTree(tree);
  if (!validation.ok) {
    for (const message of validation.errors) {
      ctx.addIssue({ code: "custom", path: [], message });
    }
  }

  checkComposerRules(tree, ctx);
});
