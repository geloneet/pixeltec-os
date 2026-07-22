/**
 * `extractPageTreeCopy` — extractor puro y compartido de copy textual de un
 * árbol de página YA VALIDADO (`ValidatedPageTree`,
 * `registry/validate-page-tree.ts`), usado por los 3 builders de la fase IA
 * advisory de QA (`critique_design`/`score_originality`/`detect_ai_likeness`,
 * PF-F8 T5): cada uno consume esta misma extracción de forma distinta
 * (resumen por nodo con headline/copy vs. copy agregado de todo el árbol),
 * pero la extracción en sí es UNA sola fuente — brief del plan: "la
 * extracción es una".
 *
 * Recorre recursivamente las `props` (ya parseadas/validadas contra el
 * `propsSchema` del registry — objetos anidados, arrays de objetos, p.ej.
 * `cta.label` o `features[].descripcion`) de cada nodo y junta los strings de
 * contenido no vacíos, en el orden en que aparecen. Excluye cualquier valor
 * que cuelgue de una key `href`: son URLs/rutas (ya validadas por
 * `isSafeHref`/`hrefSchema` en `registry/blocks.ts`), no copy para un lector
 * — incluirlas en la crítica/originalidad/detección de IA no aporta señal y
 * podría filtrar rutas internas al prompt sin necesidad.
 *
 * Límites (evitan que un árbol grande o con arrays largos infle el prompt sin
 * control): como máximo `MAX_TEXTS_PER_NODE` strings por nodo, cada uno
 * truncado a `MAX_TEXT_LENGTH` caracteres (con "…" al final si se truncó).
 */

export interface ExtractedNodeCopy {
  nodeId: string;
  componentId: string;
  variant: string;
  orden: number;
  /** Strings de contenido extraídos de `props`, en orden de aparición — sin hrefs, acotados por los límites de arriba. */
  texts: string[];
}

/**
 * Forma mínima que este módulo necesita de un árbol de página — evita
 * acoplar `extract-copy.ts` al import completo de `ValidatedPageTree`
 * (`registry/validate-page-tree.ts`) solo por el tipo; cualquier
 * `ValidatedPageTree` real satisface esta forma por tipado estructural, así
 * que los builders pueden pasar el árbol tal cual sin castear.
 */
export interface PageTreeNodeForCopy {
  nodeId: string;
  componentId: string;
  variant: string;
  orden: number;
  props: unknown;
}
export interface PageTreeForCopy {
  nodes: PageTreeNodeForCopy[];
}

/** Máximo de strings de copy que se extraen por nodo. */
export const MAX_TEXTS_PER_NODE = 20;
/** Máximo de caracteres por string extraído — el resto se trunca con "…". */
export const MAX_TEXT_LENGTH = 300;

const EXCLUDED_KEY = "href";

function collectStrings(value: unknown, key: string | undefined, out: string[]): void {
  if (out.length >= MAX_TEXTS_PER_NODE) return;

  if (typeof value === "string") {
    if (key === EXCLUDED_KEY) return; // URL/ruta, no copy — ver docstring del módulo.
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    out.push(trimmed.length > MAX_TEXT_LENGTH ? `${trimmed.slice(0, MAX_TEXT_LENGTH)}…` : trimmed);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      if (out.length >= MAX_TEXTS_PER_NODE) return;
      collectStrings(item, undefined, out);
    }
    return;
  }

  if (value !== null && typeof value === "object") {
    for (const [nestedKey, nested] of Object.entries(value as Record<string, unknown>)) {
      if (out.length >= MAX_TEXTS_PER_NODE) return;
      collectStrings(nested, nestedKey, out);
    }
  }
}

export function extractPageTreeCopy(tree: PageTreeForCopy): ExtractedNodeCopy[] {
  return tree.nodes.map((node) => {
    const texts: string[] = [];
    collectStrings(node.props, undefined, texts);
    return {
      nodeId: node.nodeId,
      componentId: node.componentId,
      variant: node.variant,
      orden: node.orden,
      texts,
    };
  });
}
