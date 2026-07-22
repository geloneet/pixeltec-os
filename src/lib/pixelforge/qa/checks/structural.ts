/**
 * Checks de estructura (QA-ST-*, PF-F8 T2) — todos `det`, sin DB/red/fecha.
 * ST-001 corre sobre el JSON crudo (antes de `validatePageTree`); ST-002/003
 * corren sobre el `ValidatedPageTree` que produjo esa misma validación —
 * `run-deterministic.ts` es quien decide (según si `validatePageTree` pasó)
 * si llama a ST-002/003 o los manda a `checksSkipped`.
 *
 * QA-ST-004 no se ejecuta aquí (T4 lo cierra al comparar contra
 * `max(version)`, algo que este módulo no puede saber sin DB) — solo se
 * exporta el helper puro `buildStaleVersionFinding` que T4 invoca.
 */
import type { ValidatedPageTree } from "@/lib/pixelforge/registry/validate-page-tree";
import { buildLocationKey } from "../location-key";
import type { QaFindingInput } from "../catalog";

const FOOTER_CONTACT_COMPONENT_ID = "footer-contact";
/** Mismos límites que `checkComposerRules` (`schemas/compose-page-tree.ts`) — reimplementados aquí puros (ese helper no es exportado y vive tras zod/v4). */
const MIN_COMPOSER_NODES = 3;
const MAX_COMPOSER_NODES = 14;

/**
 * QA-ST-001 — un finding POR error de `validatePageTree`. `errors` es
 * `PageTreeValidation.errors` (rama `ok:false`) tal cual. El índice de cada
 * error en el array se usa como `selectorHash` de su `location`: sin esto,
 * todos los findings compartirían la MISMA `locationKey` ("QA-ST-001|-|-|-")
 * y el dedupe `(qaRunId, checkCode, locationKey)` de `insertQaFindings` (T1)
 * colapsaría varios errores reales en una sola fila.
 */
export function checkST001(errors: readonly string[]): QaFindingInput[] {
  return errors.map((message, index) => {
    const location = { selectorHash: String(index) };
    return {
      checkCode: "QA-ST-001",
      category: "estructura",
      severity: "critical",
      blocking: true,
      source: "det",
      title: "El árbol de la página no valida contra el registry",
      description: message,
      recommendation:
        "Corrige el árbol para que pase validatePageTree antes de continuar — cada error debe resolverse en el origen (composer/edición manual).",
      location,
      locationKey: buildLocationKey("QA-ST-001", location),
    };
  });
}

function buildST002Finding(selectorHash: string, description: string): QaFindingInput {
  const location = { selectorHash };
  return {
    checkCode: "QA-ST-002",
    category: "estructura",
    severity: "critical",
    blocking: true,
    source: "det",
    title: "El árbol no cumple 3-14 nodos con un único footer-contact al final",
    description,
    recommendation:
      "Ajusta el número de nodos (3-14), asegura exactamente un nodo footer-contact y colócalo como el de mayor orden.",
    location,
    locationKey: buildLocationKey("QA-ST-002", location),
  };
}

/**
 * QA-ST-002 — reimplementación PURA (sin zod/v4) de las reglas de salida del
 * composer que `checkComposerRules` (`schemas/compose-page-tree.ts`) aplica
 * sobre el JSON crudo: 3-14 nodos, exactamente un `footer-contact`, al final
 * (mayor `orden`). Opera sobre el árbol YA VALIDADO — equivalente en
 * comportamiento a `checkComposerRules` para cualquier árbol que ya pasó
 * `validatePageTree` (`structural.test.ts` cubre casos de equivalencia).
 * Puede emitir hasta 3 findings independientes (uno por sub-regla violada).
 */
export function checkST002(tree: ValidatedPageTree): QaFindingInput[] {
  const findings: QaFindingInput[] = [];
  const nodeCount = tree.nodes.length;

  if (nodeCount < MIN_COMPOSER_NODES || nodeCount > MAX_COMPOSER_NODES) {
    findings.push(
      buildST002Finding(
        "node-count",
        `El árbol tiene ${nodeCount} nodos — debe tener entre ${MIN_COMPOSER_NODES} y ${MAX_COMPOSER_NODES}.`
      )
    );
  }

  const footerNodes = tree.nodes.filter((node) => node.componentId === FOOTER_CONTACT_COMPONENT_ID);

  if (footerNodes.length === 0) {
    findings.push(buildST002Finding("footer-count", "El árbol debe cerrar con un nodo footer-contact."));
  } else if (footerNodes.length > 1) {
    findings.push(
      buildST002Finding("footer-count", `Solo puede haber un nodo footer-contact en el árbol (hay ${footerNodes.length}).`)
    );
  } else if (nodeCount > 0) {
    const maxOrden = Math.max(...tree.nodes.map((node) => node.orden));
    if (footerNodes[0]!.orden !== maxOrden) {
      findings.push(buildST002Finding("footer-position", "footer-contact debe ser el último nodo (orden más alto)."));
    }
  }

  return findings;
}

/**
 * QA-ST-003 — `orden` debe ser una secuencia 1..n consecutiva sin huecos.
 * Opera sobre el árbol YA VALIDADO (que ya garantiza `orden` únicos —
 * `validatePageTree` rechaza duplicados — así que aquí solo hace falta
 * detectar huecos, no duplicados).
 */
export function checkST003(tree: ValidatedPageTree): QaFindingInput[] {
  const ordenes = tree.nodes.map((node) => node.orden).sort((a, b) => a - b);
  const missing: number[] = [];

  for (let expected = 1; expected <= ordenes.length; expected += 1) {
    if (!ordenes.includes(expected)) missing.push(expected);
  }

  if (missing.length === 0) return [];

  const location = { selectorHash: "orden-gaps" };
  return [
    {
      checkCode: "QA-ST-003",
      category: "estructura",
      severity: "minor",
      blocking: false,
      source: "det",
      title: "El campo orden de los nodos tiene huecos",
      description: `Faltan los valores de orden: ${missing.join(", ")} (secuencia observada: ${ordenes.join(", ")}).`,
      recommendation: "Renumera orden como una secuencia consecutiva 1..n sin saltos.",
      location,
      locationKey: buildLocationKey("QA-ST-003", location),
    },
  ];
}

/**
 * QA-ST-004 (helper puro para T4) — construye el finding "la versión
 * evaluada ya no es la más reciente" cuando corresponde. `null` si
 * `evaluatedVersion === latestVersion` (nada que reportar) — T4 puede
 * invocarlo incondicionalmente al cerrar el run, sin duplicar la comparación.
 */
export function buildStaleVersionFinding(evaluatedVersion: number, latestVersion: number): QaFindingInput | null {
  if (evaluatedVersion === latestVersion) return null;

  const location = { selectorHash: "stale-version" };
  return {
    checkCode: "QA-ST-004",
    category: "estructura",
    severity: "info",
    blocking: false,
    source: "det",
    title: "El QA evaluó una versión que ya no es la más reciente",
    description: `Se evaluó la versión ${evaluatedVersion}, pero la versión más reciente del proyecto es la ${latestVersion}.`,
    recommendation: "Vuelve a correr el QA sobre la versión actual antes de cerrar la estación.",
    location,
    locationKey: buildLocationKey("QA-ST-004", location),
  };
}
