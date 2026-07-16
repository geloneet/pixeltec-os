/**
 * Envuelve contenido no confiable (brain dump, texto de fuentes de usuario)
 * en un fence con delimitadores únicos, para que el system prompt pueda
 * instruir al modelo a tratarlo como DATOS y no como instrucciones.
 *
 * Nota: esto reduce la superficie de prompt injection, NO es una garantía
 * total. La defensa real es Structured Outputs + enums cerrados en los
 * schemas de salida (condición 5 del Gate 0) — un atacante que logre que el
 * modelo "obedezca" texto inyectado sigue limitado a devolver algo que
 * valide contra el schema de la operación.
 */
const FENCE_OPEN_PREFIX = "<<<CONTENIDO_NO_CONFIABLE:";
const FENCE_OPEN_SUFFIX = ">>>";
const FENCE_CLOSE = "<<<FIN>>>";

/**
 * Neutraliza cualquier aparición del ESQUEMA de delimitador (`<<<...>>>`)
 * dentro de un texto: si no lo hiciéramos, contenido no confiable podría
 * inyectar su propio `<<<FIN>>>` para "cerrar" un fence antes de tiempo, o un
 * `<<<CONTENIDO_NO_CONFIABLE:otro-label>>>` falso para simular que el resto
 * del texto viene de otra fuente. Extraído de `wrapUntrustedContent` para
 * poder aplicarse también a contenido que NO se envuelve en un fence (p.ej.
 * el Context Brief sellado, que se cita directo en el prompt).
 */
export function neutralizeDelimiters(content: string): string {
  return content
    .split(FENCE_OPEN_PREFIX)
    .join("[delimitador neutralizado: ")
    .split(FENCE_CLOSE)
    .join("[fin neutralizado]");
}

export function wrapUntrustedContent(label: string, content: string): string {
  const open = `${FENCE_OPEN_PREFIX}${label}${FENCE_OPEN_SUFFIX}`;
  const neutralized = neutralizeDelimiters(content);

  return `${open}\n${neutralized}\n${FENCE_CLOSE}`;
}
