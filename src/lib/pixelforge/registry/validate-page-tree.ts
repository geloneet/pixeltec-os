/**
 * `validatePageTree` — LA puerta única entre el JSON que produce
 * `compose_page_tree` (IA) y cualquier árbol que se persiste o se renderiza.
 * Corre antes de todo insert en `page_versions` (F7) y antes de todo render
 * (T7 la usa para el fixture de preview) — sin excepciones.
 *
 * Orden de validación, acumulando errores (nunca corta en el primero):
 *   1. `pageTreeSchema.safeParse` (shape base, zod/v4, self-contenido) —
 *      shape de nodos, `propsJson` como string, nodeId únicos, min 3 nodos.
 *      Si esto falla no tiene sentido seguir: se devuelve `ok:false` de una vez.
 *   2. Por nodo (zod v3 desde aquí en adelante — este archivo vive en
 *      `registry/`, fuera de `schemas/`): `componentId` registrado en
 *      `PIXELFORGE_BLOCKS`; `variant` ∈ `def.variants`; `propsJson` parseable
 *      como JSON; props resultantes contra `def.propsSchema`; si hay
 *      `choreography`, cada `sequence.targetSlot` ∈ `def.editableSlots` y
 *      cualquier `intensity === 3` exige `def.allowsCinematic`.
 *   3. Global: como máximo `MAX_CINEMATIC_NODES` nodos con alguna sequence
 *      `intensity === 3` en todo el árbol; `orden` únicos entre nodos.
 *
 * `behaviorId` es la única excepción "suave": el registry de behaviors llega
 * en F6B, así que hoy no hay contra qué validarlo — cada `behaviorId` que
 * aparece en una `sequence` produce un WARNING (no un error) y nunca bloquea
 * `ok:true`.
 */
import { pageTreeSchema, type PageTree } from "@/lib/pixelforge/schemas/compose-page-tree";
import { getBlockDefinition, isRegisteredBlockId, type BlockId } from "./blocks";

type PageTreeNode = PageTree["nodes"][number];
type Choreography = NonNullable<PageTreeNode["choreography"]>;

export interface ValidatedPageNode {
  nodeId: string;
  componentId: BlockId;
  variant: string;
  orden: number;
  /** Props ya parseadas (de `propsJson`) y validadas contra `def.propsSchema` — listas para el renderer. */
  props: unknown;
  choreography?: Choreography;
}

export interface ValidatedPageTree {
  nodes: ValidatedPageNode[];
  notas: string;
}

export type PageTreeValidation =
  | { ok: true; tree: ValidatedPageTree; warnings: string[] }
  | { ok: false; errors: string[] };

/** Máximo de nodos con alguna sequence `intensity === 3` en todo el árbol. */
const MAX_CINEMATIC_NODES = 3;

export function validatePageTree(input: unknown): PageTreeValidation {
  const shapeResult = pageTreeSchema.safeParse(input);
  if (!shapeResult.success) {
    return { ok: false, errors: shapeResult.error.issues.map((issue) => issue.message) };
  }

  const tree = shapeResult.data;
  const errors: string[] = [];
  const warnings: string[] = [];
  const validatedNodes: ValidatedPageNode[] = [];
  const cinematicNodeIds = new Set<string>();
  const nodeIdsByOrden = new Map<number, string[]>();

  for (const node of tree.nodes) {
    const ordenGroup = nodeIdsByOrden.get(node.orden) ?? [];
    ordenGroup.push(node.nodeId);
    nodeIdsByOrden.set(node.orden, ordenGroup);

    if (!isRegisteredBlockId(node.componentId)) {
      errors.push(`componentId "${node.componentId}" no está registrado en el catálogo de blocks — nodo "${node.nodeId}".`);
      continue;
    }

    const def = getBlockDefinition(node.componentId);

    if (!def.variants.includes(node.variant)) {
      errors.push(
        `variant "${node.variant}" no es válida para "${node.componentId}" — nodo "${node.nodeId}" (variants válidas: ${def.variants.join(", ")}).`
      );
    }

    let parsedProps: unknown;
    let parseOk = true;
    try {
      parsedProps = JSON.parse(node.propsJson) as unknown;
    } catch {
      parseOk = false;
      errors.push(`propsJson inválido en ${node.nodeId}.`);
    }

    let props: unknown;
    if (parseOk) {
      const propsResult = def.propsSchema.safeParse(parsedProps);
      if (!propsResult.success) {
        for (const issue of propsResult.error.issues) {
          const path = issue.path.length > 0 ? issue.path.join(".") : "(raíz)";
          errors.push(`props inválidas en nodo "${node.nodeId}" (${path}): ${issue.message}.`);
        }
      } else {
        props = propsResult.data;
      }
    }

    if (node.choreography) {
      let nodeHasCinematicSequence = false;
      for (const sequence of node.choreography.sequences) {
        if (!def.editableSlots.includes(sequence.targetSlot)) {
          errors.push(
            `targetSlot "${sequence.targetSlot}" no existe en editableSlots de "${node.componentId}" — nodo "${node.nodeId}".`
          );
        }
        if (sequence.intensity === 3) {
          nodeHasCinematicSequence = true;
          if (!def.allowsCinematic) {
            errors.push(
              `intensity 3 (cinematográfica) no permitida en "${node.componentId}" — el block no admite coreografía cinematográfica (nodo "${node.nodeId}").`
            );
          }
        }
        // Behaviors registry llega en F6B — hoy no hay contra qué validar behaviorId, solo advertir.
        warnings.push(`behaviors registry llega en F6B: ${sequence.behaviorId} sin verificar (nodo "${node.nodeId}").`);
      }
      if (nodeHasCinematicSequence) {
        cinematicNodeIds.add(node.nodeId);
      }
    }

    validatedNodes.push({
      nodeId: node.nodeId,
      componentId: node.componentId,
      variant: node.variant,
      orden: node.orden,
      props,
      choreography: node.choreography,
    });
  }

  if (cinematicNodeIds.size > MAX_CINEMATIC_NODES) {
    errors.push(
      `máximo ${MAX_CINEMATIC_NODES} nodos cinematográficos (alguna sequence intensity 3) permitidos por árbol — se encontraron ${cinematicNodeIds.size}.`
    );
  }

  for (const [orden, nodeIds] of nodeIdsByOrden) {
    if (nodeIds.length > 1) {
      errors.push(`orden ${orden} duplicado en los nodos: ${nodeIds.join(", ")}.`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    tree: { nodes: validatedNodes, notas: tree.notas },
    warnings,
  };
}
