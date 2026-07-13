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
