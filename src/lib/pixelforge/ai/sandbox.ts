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

export function wrapUntrustedContent(label: string, content: string): string {
  const open = `${FENCE_OPEN_PREFIX}${label}${FENCE_OPEN_SUFFIX}`;

  // Neutraliza cualquier aparición del ESQUEMA de delimitador dentro del
  // contenido (no solo el de este label): si no lo hiciéramos, el contenido
  // no confiable podría inyectar su propio `<<<FIN>>>` para "cerrar" el
  // fence antes de tiempo, o un `<<<CONTENIDO_NO_CONFIABLE:otro-label>>>`
  // falso para simular que el resto del texto viene de otra fuente.
  const neutralized = content
    .split(FENCE_OPEN_PREFIX)
    .join("[delimitador neutralizado: ")
    .split(FENCE_CLOSE)
    .join("[fin neutralizado]");

  return `${open}\n${neutralized}\n${FENCE_CLOSE}`;
}
