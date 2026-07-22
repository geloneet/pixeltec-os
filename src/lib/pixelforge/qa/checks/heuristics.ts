/**
 * Checks heurísticos (QA-VI-008/009, QA-MO-004/006, QA-CA-001, QA-TE-009,
 * PF-F8 T2) — todos operan sobre un `ValidatedPageTree` (post
 * `validatePageTree`). Severidad `minor`/`major` salvo TE-009 (`critical`,
 * `blocking:true` — es la única excepción de esta familia: un href inseguro
 * es un vector de XSS/redirect real, no una preferencia de estilo).
 *
 * Todos son "heu": aproximaciones deliberadamente conservadoras — pueden
 * marcar contenido que en la práctica renderiza bien (falsos positivos
 * tolerables dado que ninguno bloquea salvo TE-009), nunca al revés.
 */
import type { ValidatedPageTree, ValidatedPageNode } from "@/lib/pixelforge/registry/validate-page-tree";
import { isSafeHref } from "@/lib/pixelforge/registry/blocks";
import { SIGNATURE_CAPABILITIES } from "@/lib/pixelforge/registry/capabilities";
import { isRegisteredBlockId } from "@/lib/pixelforge/registry/blocks";
import { DURATION_MS_BY_TOKEN, RHYTHM_FACTOR, DEFAULT_RITMO, DELAY_INDEX_ORDER_MS, DELAY_CHILD_STAGGER_BASE_MS, DELAY_DISTANCE_ORDER_MS, DELAY_DISTANCE_BASE_MS, DELAY_SEMANTIC_BASE_MS, DELAY_SEMANTIC_ORDER_MS, type MotionDnaInput } from "@/components/pixelforge/render/motion/resolve";
import { buildLocationKey } from "../location-key";
import {
  HERO_TITLE_MAX_CHARS,
  CTA_LABEL_MAX_CHARS,
  PARAGRAPH_MAX_CHARS,
  MIN_ITEMS_BY_BLOCK,
  ITEMS_FIELD_BY_BLOCK,
  MOTION_SEQUENCE_BUDGET_MS,
  MAX_CONTIGUOUS_CINEMATIC_NODES,
  type QaFindingInput,
} from "../catalog";

// ─── Helpers genéricos ───────────────────────────────────────────────────────

/** Recorre `value` recursivamente y llama a `visit(path, leafValue)` por cada leaf string encontrado. */
function walkStrings(value: unknown, path: readonly string[], visit: (path: readonly string[], leaf: string) => void): void {
  if (typeof value === "string") {
    visit(path, value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkStrings(item, [...path, String(index)], visit));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      walkStrings(nested, [...path, key], visit);
    }
  }
}

const HERO_COMPONENT_IDS = new Set(["hero-split", "hero-editorial"]);

// ─── QA-VI-008 — copy vs límites por slot ───────────────────────────────────

function buildVI008Finding(node: ValidatedPageNode, slot: string, limit: number, actual: number): QaFindingInput {
  const location = { nodeId: node.nodeId, slot };
  return {
    checkCode: "QA-VI-008",
    category: "visual",
    severity: "minor",
    blocking: false,
    source: "heu",
    title: "Copy por encima del límite recomendado para su slot",
    description: `El nodo "${node.nodeId}" (${node.componentId}, slot "${slot}") tiene ${actual} caracteres — el límite recomendado es ${limit}.`,
    recommendation: "Acorta el texto para que quepa cómodamente en el slot (título de hero, label de CTA o párrafo).",
    location,
    locationKey: buildLocationKey("QA-VI-008", location),
  };
}

/**
 * QA-VI-008 — hero title >90, cta label >32, cualquier otro texto (párrafo)
 * >600. Clasifica por el ÚLTIMO segmento del path: `titulo` en un hero-*
 * block usa el límite de hero; `cta.label`/`ctaLabel` usa el límite de CTA;
 * cualquier otro string usa el límite de párrafo.
 */
export function checkVI008(tree: ValidatedPageTree): QaFindingInput[] {
  const findings: QaFindingInput[] = [];

  for (const node of tree.nodes) {
    walkStrings(node.props, [], (path, leaf) => {
      const lastSegment = path[path.length - 1];
      const parentSegment = path[path.length - 2];
      const slot = path.join(".") || "(raíz)";

      if (lastSegment === "titulo" && path.length === 1 && HERO_COMPONENT_IDS.has(node.componentId)) {
        if (leaf.length > HERO_TITLE_MAX_CHARS) {
          findings.push(buildVI008Finding(node, slot, HERO_TITLE_MAX_CHARS, leaf.length));
        }
        return;
      }

      const isCtaLabel = lastSegment === "ctaLabel" || (lastSegment === "label" && parentSegment === "cta");
      if (isCtaLabel) {
        if (leaf.length > CTA_LABEL_MAX_CHARS) {
          findings.push(buildVI008Finding(node, slot, CTA_LABEL_MAX_CHARS, leaf.length));
        }
        return;
      }

      if (leaf.length > PARAGRAPH_MAX_CHARS) {
        findings.push(buildVI008Finding(node, slot, PARAGRAPH_MAX_CHARS, leaf.length));
      }
    });
  }

  return findings;
}

// ─── QA-VI-009 — ítems bajo el mínimo por block ─────────────────────────────

/**
 * QA-VI-009 — un block de lista/grid (`MIN_ITEMS_BY_BLOCK` en `catalog.ts`)
 * con menos ítems que su mínimo recomendado. Hoy los `propsSchema` del
 * registry ya garantizan mínimos de ítems ≥ a los umbrales de
 * `MIN_ITEMS_BY_BLOCK`, por lo que este check es inalcanzable en el pipeline
 * actual; se conserva deliberadamente como red independiente por si el
 * registry relaja sus mínimos (QA no asume invariantes de otras capas).
 */
export function checkVI009(tree: ValidatedPageTree): QaFindingInput[] {
  const findings: QaFindingInput[] = [];

  for (const node of tree.nodes) {
    const min = MIN_ITEMS_BY_BLOCK[node.componentId];
    if (min === undefined) continue;
    const field = ITEMS_FIELD_BY_BLOCK[node.componentId]!;

    const items = (node.props as Record<string, unknown> | null)?.[field];
    if (!Array.isArray(items)) continue;
    if (items.length >= min) continue;

    const location = { nodeId: node.nodeId, slot: field };
    findings.push({
      checkCode: "QA-VI-009",
      category: "visual",
      severity: "minor",
      blocking: false,
      source: "heu",
      title: "Un bloque de lista/grid quedó por debajo del mínimo recomendado de ítems",
      description: `El nodo "${node.nodeId}" (${node.componentId}) tiene ${items.length} ítems en "${field}" — el mínimo recomendado es ${min}.`,
      recommendation: "Agrega más ítems al bloque (features, preguntas, logos, tiers, pasos o stats) para que se vea completo.",
      location,
      locationKey: buildLocationKey("QA-VI-009", location),
    });
  }

  return findings;
}

// ─── QA-MO-004 — formato de count-up que el parser puede degradar ───────────

/**
 * Misma forma de extracción que `parseCountTarget`
 * (`components/pixelforge/render/motion/MotionSection.tsx`): prefijo no
 * numérico + dígitos/puntos/comas + sufijo. Se replica aquí en vez de
 * importar el componente cliente (arrastraría React/framer-motion a un
 * módulo puro server-side).
 */
const COUNT_VALUE_RE = /^([^\d]*)([\d.,]+)(.*)$/;

/** `true` si `valor` tiene un formato que el parser real puede degradar: no-numérico, separador de millares (`,`), o más de un punto decimal (ambigüedad decimal vs. millares). */
function isDegradedCountFormat(valor: string): boolean {
  const match = COUNT_VALUE_RE.exec(valor);
  if (!match) return true; // sin ningún dígito — el parser no cuenta nada.
  const numStr = match[2]!;
  if (numStr.includes(",")) return true; // separador de millares — se marca por precaución aunque el parser real lo tolera.
  if ((numStr.match(/\./g)?.length ?? 0) > 1) return true; // dos o más puntos: parseFloat trunca en el segundo, da un número incorrecto.
  return false;
}

/** QA-MO-004 — un `valor` de `stats-band` con formato que el parser de count-up puede degradar. */
export function checkMO004(tree: ValidatedPageTree): QaFindingInput[] {
  const findings: QaFindingInput[] = [];

  for (const node of tree.nodes) {
    if (node.componentId !== "stats-band") continue;
    const stats = (node.props as Record<string, unknown> | null)?.stats;
    if (!Array.isArray(stats)) continue;

    stats.forEach((stat, index) => {
      const valor = (stat as Record<string, unknown> | null)?.valor;
      if (typeof valor !== "string") return;
      if (!isDegradedCountFormat(valor)) return;

      const location = { nodeId: node.nodeId, slot: `stats.${index}.valor` };
      findings.push({
        checkCode: "QA-MO-004",
        category: "motion",
        severity: "minor",
        blocking: false,
        source: "heu",
        title: "Un valor de count-up tiene un formato que el parser puede degradar",
        description: `El nodo "${node.nodeId}" tiene stats[${index}].valor="${valor}" — este formato puede degradar el conteo animado.`,
        recommendation: "Usa cifras sin separador de millares (o verifica manualmente el conteo animado) para el valor de esta estadística.",
        location,
        locationKey: buildLocationKey("QA-MO-004", location),
      });
    });
  }

  return findings;
}

// ─── QA-MO-006 — secuencia estimada demasiado larga / demasiados cinematic contiguos ─

/**
 * Estimación de delay en ms — misma fórmula que `resolveDelayMs`
 * (`render/motion/resolve.ts`, no exportada), reconstruida aquí SOLO con las
 * constantes exportadas de ese módulo (fuente única de los números). El
 * `rhythmFactor` que recibe viene de `checkMO006`: ritmo real de la dirección
 * si `motionDna` llegó (PF-F8 T4, extensión aditiva), o el ritmo neutro
 * (`DEFAULT_RITMO`, factor 1.0) si no — ver docstring de `checkMO006`.
 */
function estimateDelayMs(
  strategy: "none" | "index" | "distance" | "semantic",
  order: number,
  rhythmFactor: number,
  childStaggerMs: number
): number {
  switch (strategy) {
    case "none":
      return 0;
    case "index":
      return Math.round(order * DELAY_INDEX_ORDER_MS * rhythmFactor + childStaggerMs);
    case "distance":
      return Math.round(order * DELAY_DISTANCE_ORDER_MS * rhythmFactor + DELAY_DISTANCE_BASE_MS * rhythmFactor);
    case "semantic":
      return Math.round(DELAY_SEMANTIC_BASE_MS * rhythmFactor + order * DELAY_SEMANTIC_ORDER_MS * rhythmFactor);
    default:
      return 0;
  }
}

function buildMO006DurationFinding(node: ValidatedPageNode, offendingSlots: string[]): QaFindingInput {
  const location = { nodeId: node.nodeId, selectorHash: "sequence-duration" };
  return {
    checkCode: "QA-MO-006",
    category: "motion",
    severity: "minor",
    blocking: false,
    source: "heu",
    title: "Secuencia de motion estimada demasiado larga o con demasiados nodos cinematográficos contiguos",
    description: `El nodo "${node.nodeId}" tiene secuencias (${offendingSlots.join(", ")}) con delay+duración estimados por encima de ${MOTION_SEQUENCE_BUDGET_MS}ms (ritmo neutro).`,
    recommendation: "Reduce la duración/delay de la secuencia o reparte los nodos cinematográficos para que no queden más de 2 consecutivos.",
    location,
    locationKey: buildLocationKey("QA-MO-006", location),
  };
}

function buildMO006ContiguousFinding(nodeIds: readonly string[]): QaFindingInput {
  const location = { selectorHash: "contiguous-cinematic" };
  return {
    checkCode: "QA-MO-006",
    category: "motion",
    severity: "minor",
    blocking: false,
    source: "heu",
    title: "Secuencia de motion estimada demasiado larga o con demasiados nodos cinematográficos contiguos",
    description: `Hay ${nodeIds.length} nodos cinematográficos consecutivos: ${nodeIds.join(", ")} — el máximo recomendado es ${MAX_CONTIGUOUS_CINEMATIC_NODES}.`,
    recommendation: "Reduce la duración/delay de la secuencia o reparte los nodos cinematográficos para que no queden más de 2 consecutivos.",
    location,
    locationKey: buildLocationKey("QA-MO-006", location),
  };
}

/**
 * QA-MO-006 — duración+delay estimados por sequence >2.5s, O más de
 * `MAX_CONTIGUOUS_CINEMATIC_NODES` nodos cinematográficos consecutivos
 * (ordenados por `orden`). `motionDna` es OPCIONAL (PF-F8 T4, extensión
 * aditiva de `DeterministicChecksInput`, T2): si llega, usa
 * `motionDna.ritmo` real de la dirección elegida para el `rhythmFactor` —
 * mismo default (`motionDna?.ritmo ?? DEFAULT_RITMO`, y `RHYTHM_FACTOR[ritmo]
 * ?? RHYTHM_FACTOR[DEFAULT_RITMO]` si el valor no es una clave válida) que
 * usa el resolver real (`resolveChoreography`, `render/motion/resolve.ts`) —
 * así la estimación deja de asumir SIEMPRE el ritmo neutro cuando el dato
 * está disponible. Si `motionDna` no llega (o es `undefined`), el
 * comportamiento es IDÉNTICO al de antes de esta extensión.
 */
export function checkMO006(tree: ValidatedPageTree, motionDna?: MotionDnaInput): QaFindingInput[] {
  const findings: QaFindingInput[] = [];
  const ritmo = motionDna?.ritmo ?? DEFAULT_RITMO;
  const rhythmFactor = RHYTHM_FACTOR[ritmo] ?? RHYTHM_FACTOR[DEFAULT_RITMO];
  const childStaggerMs = Math.round(DELAY_CHILD_STAGGER_BASE_MS * rhythmFactor);

  for (const node of tree.nodes) {
    if (!node.choreography) continue;
    const offendingSlots: string[] = [];

    for (const sequence of node.choreography.sequences) {
      const durationMs = Math.round(DURATION_MS_BY_TOKEN[sequence.durationToken] * rhythmFactor);
      const delayMs = estimateDelayMs(sequence.delayStrategy, sequence.order, rhythmFactor, childStaggerMs);
      if (durationMs + delayMs > MOTION_SEQUENCE_BUDGET_MS) {
        offendingSlots.push(sequence.targetSlot);
      }
    }

    if (offendingSlots.length > 0) {
      findings.push(buildMO006DurationFinding(node, offendingSlots));
    }
  }

  // Nodos cinematográficos (alguna sequence intensity===3), en el orden en que aparecen ordenados por `orden`.
  const sortedNodes = [...tree.nodes].sort((a, b) => a.orden - b.orden);
  let run: ValidatedPageNode[] = [];
  const flushRun = () => {
    if (run.length > MAX_CONTIGUOUS_CINEMATIC_NODES) {
      findings.push(buildMO006ContiguousFinding(run.map((n) => n.nodeId)));
    }
    run = [];
  };

  for (const node of sortedNodes) {
    const isCinematic = node.choreography?.sequences.some((s) => s.intensity === 3) ?? false;
    if (isCinematic) {
      run.push(node);
    } else {
      flushRun();
    }
  }
  flushRun();

  return findings;
}

// ─── QA-CA-001 — datos mínimos de una capability ────────────────────────────

/** Campo de props a contar + mínimo requerido, por `capabilityId` — nombres tomados del `propsSchema` real en `registry/capabilities.ts`. */
const CAPABILITY_MIN_ITEMS: Readonly<Record<string, { field: string; min: number }>> = {
  "comparison-table-v1": { field: "columnas", min: 2 },
  "product-selector-v1": { field: "opciones", min: 2 },
  "coverage-map-v1": { field: "zonas", min: 1 },
  "process-visualizer-v1": { field: "pasos", min: 2 },
};

/**
 * QA-CA-001 — datos mínimos por capability. Nota: para `comparison-table-v1`,
 * `coverage-map-v1` y `process-visualizer-v1` el `propsSchema` YA exige el
 * mínimo (`.min(2)`/`.min(1)`/`.min(2)` respectivamente) — este check es
 * inalcanzable en la práctica para esas tres mientras el schema no cambie,
 * pero se implementa igual como defensa en profundidad ante un drift futuro
 * del registry. `product-selector-v1` SÍ es alcanzable hoy (`propsSchema`
 * solo exige `.min(1)` opciones, no 2).
 */
export function checkCA001(tree: ValidatedPageTree): QaFindingInput[] {
  const findings: QaFindingInput[] = [];

  for (const node of tree.nodes) {
    if (node.kind !== "capability") continue;
    const spec = CAPABILITY_MIN_ITEMS[node.componentId];
    if (!spec) continue;

    const items = (node.props as Record<string, unknown> | null)?.[spec.field];
    if (!Array.isArray(items)) continue;
    if (items.length >= spec.min) continue;

    const location = { nodeId: node.nodeId, slot: spec.field };
    findings.push({
      checkCode: "QA-CA-001",
      category: "capacidades",
      severity: "major",
      blocking: false,
      source: "heu",
      title: "Una capability tiene datos por debajo del mínimo útil",
      description: `El nodo "${node.nodeId}" (${node.componentId}) tiene ${items.length} en "${spec.field}" — el mínimo útil es ${spec.min}.`,
      recommendation: "Agrega más datos (columnas, opciones, zonas o pasos) para que la capability aporte valor real al visitante.",
      location,
      locationKey: buildLocationKey("QA-CA-001", location),
    });
  }

  return findings;
}

// ─── QA-CA-005 — fallbackComponentId de una capability usada existe ─────────

/** QA-CA-005 — el `fallbackComponentId` de cada capability USADA en el árbol debe estar registrado en `PIXELFORGE_BLOCKS`. Defensa en profundidad (`BlockId` ya lo garantiza en compilación). */
export function checkCA005(tree: ValidatedPageTree): QaFindingInput[] {
  const findings: QaFindingInput[] = [];
  const usedCapabilityIds = new Set(tree.nodes.filter((n) => n.kind === "capability").map((n) => n.componentId));

  for (const capabilityId of usedCapabilityIds) {
    const definition = SIGNATURE_CAPABILITIES.find((c) => c.id === capabilityId);
    if (!definition) continue;
    if (isRegisteredBlockId(definition.fallbackComponentId)) continue;

    const location = { selectorHash: `fallback-${capabilityId}` };
    findings.push({
      checkCode: "QA-CA-005",
      category: "capacidades",
      severity: "info",
      blocking: false,
      source: "det",
      title: "El fallbackComponentId de una capability usada no está registrado",
      description: `La capability "${capabilityId}" declara fallbackComponentId="${definition.fallbackComponentId}", que no está registrado en PIXELFORGE_BLOCKS.`,
      recommendation: "Defensa en profundidad — reporta este hallazgo al equipo de plataforma, el registry debería garantizar esto en compilación.",
      location,
      locationKey: buildLocationKey("QA-CA-005", location),
    });
  }

  return findings;
}

// ─── QA-TE-009 — href inseguro en props ─────────────────────────────────────

/** QA-TE-009 — cualquier campo `href` (o `.../href` anidado, p.ej. `links[].href`) del árbol validado que no pase `isSafeHref`. Defensa en profundidad: los blocks actuales ya validan sus `href` con `hrefSchema` en `propsSchema`, esto cubre props/capabilities futuras que pudieran no reusarlo. */
export function checkTE009(tree: ValidatedPageTree): QaFindingInput[] {
  const findings: QaFindingInput[] = [];

  for (const node of tree.nodes) {
    walkStrings(node.props, [], (path, leaf) => {
      if (path[path.length - 1] !== "href") return;
      if (isSafeHref(leaf)) return;

      const slot = path.join(".");
      const location = { nodeId: node.nodeId, slot };
      findings.push({
        checkCode: "QA-TE-009",
        category: "tecnico",
        severity: "critical",
        blocking: true,
        source: "heu",
        title: "Un href de la página no es seguro (no empieza con /, # o https://)",
        description: `El nodo "${node.nodeId}" tiene un href inseguro en "${slot}": "${leaf}".`,
        recommendation: "Corrige el href para que apunte a una ruta interna, un ancla o un destino https:// externo — nunca javascript:/data:/otros esquemas.",
        location,
        locationKey: buildLocationKey("QA-TE-009", location),
      });
    });
  }

  return findings;
}
