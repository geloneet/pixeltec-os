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
 *      `registry/`, fuera de `schemas/`), `componentId` puede resolver a DOS
 *      catálogos disjuntos (F6C-T2 — `BLOCK_IDS ∩ CAPABILITY_IDS = ∅`):
 *
 *      - **block** (`componentId ∈ PIXELFORGE_BLOCKS`, `kind: "block"`):
 *        `variant` ∈ `def.variants`; `propsJson` parseable como JSON; props
 *        resultantes contra `def.propsSchema`; si hay `choreography`, por
 *        cada `sequence`: `targetSlot` ∈ `def.editableSlots`; cualquier
 *        `intensity === 3` exige `def.allowsCinematic`; `behaviorId` debe
 *        estar registrado en `./behaviors` (F6B-T2); `trigger` ∈
 *        `behavior.allowedTriggers`; `behavior.coversIntents` debe
 *        intersectar `def.motionIntents` (evita, p.ej., `count-up` en un
 *        hero); y `behavior.cinematicOnly` exige `intensity === 3`.
 *      - **capability** (`componentId ∈ CAPABILITY_IDS`, `kind: "capability"`,
 *        F6C-T2/D1): `variant` debe ser exactamente `"default"` (las
 *        capabilities no tienen variantes visuales v1); `propsJson`
 *        parseable como JSON y props resultantes contra
 *        `capability.propsSchema`; `choreography` está prohibida cuando
 *        `capability.allowsChoreography === false` (interactividad + motion
 *        sobre el mismo nodo reproduce la clase de deadlock del `useInView`
 *        de F6B). Los nodos capability NO participan en las reglas
 *        específicas de block (`editableSlots`, `allowsCinematic`,
 *        behaviors) ni cuentan para `MAX_CINEMATIC_NODES` — son una capa
 *        distinta (D4).
 *      - Si `componentId` no resuelve en ninguno de los dos catálogos: error
 *        "ni block ni capability".
 *   3. Global: como máximo `MAX_CINEMATIC_NODES` nodos **block** con alguna
 *      sequence `intensity === 3` en todo el árbol; `orden` únicos entre
 *      nodos (blocks y capabilities comparten el mismo espacio de `orden`).
 *
 * `behaviorId` ya NO es una excepción "suave" (F6B-T2 promovió el warning a
 * error real usando el registry de `./behaviors`): un `behaviorId` no
 * registrado, un `trigger` no permitido para ese behavior, un behavior que no
 * cubre ningún `motionIntent` del block, o un behavior `cinematicOnly` con
 * `intensity !== 3` bloquean `ok:true` igual que cualquier otro error de
 * coreografía. `warnings` se conserva en el tipo por estabilidad de API (F7
 * la sigue leyendo), pero hoy siempre vuelve vacío.
 */
import { pageTreeSchema, type PageTree } from "@/lib/pixelforge/schemas/compose-page-tree";
import { getBlockDefinition, isRegisteredBlockId, type BlockId } from "./blocks";
import { getBehaviorDefinition, isRegisteredBehaviorId } from "./behaviors";
import { SIGNATURE_CAPABILITIES, isCertifiedCapabilityId, type CapabilityId } from "./capabilities";

type PageTreeNode = PageTree["nodes"][number];
type Choreography = NonNullable<PageTreeNode["choreography"]>;

export interface ValidatedPageNode {
  nodeId: string;
  componentId: BlockId | CapabilityId;
  /** F6C-T2: distingue de qué catálogo viene `componentId` — el renderer (T5) resuelve por esto. */
  kind: "block" | "capability";
  variant: string;
  orden: number;
  /** Props ya parseadas (de `propsJson`) y validadas contra `def.propsSchema`/`capability.propsSchema` — listas para el renderer. */
  props: unknown;
  choreography?: Choreography;
}

/** Busca la definición de una capability certificada por id — no hay getter exportado en `./capabilities` para esto. */
function getCapabilityDefinition(id: CapabilityId) {
  const definition = SIGNATURE_CAPABILITIES.find((capability) => capability.id === id);
  if (!definition) {
    throw new Error(`Capability no registrada en SIGNATURE_CAPABILITIES: "${id}"`);
  }
  return definition;
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

    if (isRegisteredBlockId(node.componentId)) {
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
          if (!isRegisteredBehaviorId(sequence.behaviorId)) {
            errors.push(
              `behaviorId "${sequence.behaviorId}" no está registrado en el catálogo de behaviors — nodo "${node.nodeId}".`
            );
          } else {
            const behavior = getBehaviorDefinition(sequence.behaviorId);

            if (!behavior.allowedTriggers.includes(sequence.trigger)) {
              errors.push(
                `trigger "${sequence.trigger}" no es válido para el behavior "${sequence.behaviorId}" — nodo "${node.nodeId}" (triggers permitidos: ${behavior.allowedTriggers.join(", ")}).`
              );
            }

            const cubreAlgunMotionIntent = behavior.coversIntents.some((intent) => def.motionIntents.includes(intent));
            if (!cubreAlgunMotionIntent) {
              errors.push(
                `behavior "${sequence.behaviorId}" no cubre ningún motionIntent de "${node.componentId}" — nodo "${node.nodeId}" (motionIntents del block: ${def.motionIntents.join(", ")}).`
              );
            }

            if (behavior.cinematicOnly && sequence.intensity !== 3) {
              errors.push(
                `behavior "${sequence.behaviorId}" es cinematográfico y exige intensity 3 — nodo "${node.nodeId}" (intensity recibida: ${sequence.intensity}).`
              );
            }
          }
        }
        if (nodeHasCinematicSequence) {
          cinematicNodeIds.add(node.nodeId);
        }
      }

      validatedNodes.push({
        nodeId: node.nodeId,
        componentId: node.componentId,
        kind: "block",
        variant: node.variant,
        orden: node.orden,
        props,
        choreography: node.choreography,
      });
    } else if (isCertifiedCapabilityId(node.componentId)) {
      const capability = getCapabilityDefinition(node.componentId);

      if (node.variant !== "default") {
        errors.push(
          `variant "${node.variant}" no es válida para la capability "${node.componentId}" — nodo "${node.nodeId}" (las capabilities solo admiten variant "default").`
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
        const propsResult = capability.propsSchema.safeParse(parsedProps);
        if (!propsResult.success) {
          for (const issue of propsResult.error.issues) {
            const path = issue.path.length > 0 ? issue.path.join(".") : "(raíz)";
            errors.push(`props inválidas en nodo "${node.nodeId}" (${path}): ${issue.message}.`);
          }
        } else {
          props = propsResult.data;
        }
      }

      if (node.choreography && !capability.allowsChoreography) {
        errors.push(
          `la capability "${node.componentId}" no admite choreography en v1 — nodo "${node.nodeId}" (interactividad y motion no se combinan sobre el mismo nodo).`
        );
      }

      // Los nodos capability NO cuentan para MAX_CINEMATIC_NODES ni participan
      // en reglas específicas de block (editableSlots, allowsCinematic, behaviors) — D4/D1.
      validatedNodes.push({
        nodeId: node.nodeId,
        componentId: node.componentId,
        kind: "capability",
        variant: node.variant,
        orden: node.orden,
        props,
        choreography: node.choreography,
      });
    } else {
      errors.push(
        `componentId "${node.componentId}" no está registrado ni como block ni como capability — nodo "${node.nodeId}".`
      );
    }
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
