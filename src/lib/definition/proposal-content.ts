/**
 * El sellado de la estación `mvp` trae dos secciones H1 en el mismo bloque:
 * "# MVP 1.0" (funciones aceptadas) y "# Congeladora" (funciones recortadas,
 * uso interno del PM — ver prompt en stations.ts). La propuesta al cliente
 * solo debe mostrar lo aceptado; corta todo desde "# Congeladora" en adelante.
 */
export function stripCongeladora(markdown: string): string {
  const match = markdown.match(/^#\s*Congeladora\b/im);
  if (!match || match.index === undefined) return markdown;
  return markdown.slice(0, match.index).trimEnd();
}

/**
 * El PM_PERSONA compartido (ver stations.ts) le permite a CUALQUIER estación
 * — boceto, funciones, mvp, flujo — cerrar su documento con una sección
 * "## Preguntas del PM": retos/dudas para que el usuario itere dentro del
 * flujo de Definición. Es trabajo interno, nunca contenido para el cliente.
 * A diferencia de stripCongeladora (solo aplica a "mvp"), esto puede aparecer
 * en cualquier estación, así que se aplica a todo lo que alimenta la
 * propuesta (scope/solution/deliverables).
 */
export function stripPmQuestions(markdown: string): string {
  const match = markdown.match(/^##\s*Preguntas del PM\b/im);
  if (!match || match.index === undefined) return markdown;
  return markdown.slice(0, match.index).trimEnd();
}
