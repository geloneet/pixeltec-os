/**
 * Deduplicación del JSON-LD del sitio (SEO-03, WO-2026-00268).
 *
 * El sitio emite dos fuentes de datos estructurados a la vez:
 *
 *  1. El código (`components/seo/structured-data.tsx`), que publica un
 *     `@graph` con Organization + WebSite construidos desde `site-config`.
 *  2. El módulo SEO, que publica lo que Miguel guarde en la base de datos
 *     (`seo_structured_data`, `seo_local_business`).
 *
 * Cuando el bloque de la base de datos trae otra vez Organization o WebSite
 * —lo normal, porque su prompt pide justo esas entidades— la página termina
 * con dos nodos del mismo `@id` y datos distintos; Google se queda con uno
 * arbitrario. Este módulo filtra del bloque publicado lo que el código ya
 * emite y deja pasar lo demás (LocalBusiness, por ejemplo), que es la parte
 * que de verdad aporta.
 *
 * Módulo puro (sin `db`, sin `next`) para poder testearlo.
 */

/** Tipos que el código emite siempre desde `site-config`. */
export const CODE_EMITTED_TYPES = ['Organization', 'WebSite'] as const;

type JsonNode = Record<string, unknown>;

function typesOf(node: JsonNode): string[] {
  const raw = node['@type'];
  if (typeof raw === 'string') return [raw];
  if (Array.isArray(raw)) return raw.filter((t): t is string => typeof t === 'string');
  return [];
}

function isDuplicate(node: JsonNode, ids: Set<string>, types: Set<string>): boolean {
  const id = node['@id'];
  if (typeof id === 'string' && ids.has(id)) return true;
  return typesOf(node).some((t) => types.has(t));
}

/**
 * Devuelve el JSON del bloque publicado sin los nodos que el código ya emite,
 * o `null` si no queda nada que valga la pena imprimir.
 *
 * @param codeIds  `@id` que el código ya publica (p. ej. `.../#organization`).
 * @param publishedRaw  El JSON tal cual está guardado en la base de datos.
 */
export function mergePublishedGraph(
  codeIds: readonly string[],
  publishedRaw: string,
  codeTypes: readonly string[] = CODE_EMITTED_TYPES,
): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(publishedRaw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const ids = new Set(codeIds);
  const types = new Set(codeTypes);

  // Un array suelto en la raíz también es JSON-LD válido.
  if (Array.isArray(parsed)) {
    const kept = (parsed as JsonNode[]).filter((n) => n && typeof n === 'object' && !isDuplicate(n, ids, types));
    return kept.length > 0 ? JSON.stringify(kept) : null;
  }

  const root = parsed as JsonNode;
  const graph = root['@graph'];
  if (Array.isArray(graph)) {
    const kept = (graph as JsonNode[]).filter((n) => n && typeof n === 'object' && !isDuplicate(n, ids, types));
    if (kept.length === 0) return null;
    return JSON.stringify({ ...root, '@graph': kept });
  }

  // Nodo suelto: o se descarta entero, o pasa entero.
  return isDuplicate(root, ids, types) ? null : JSON.stringify(root);
}
