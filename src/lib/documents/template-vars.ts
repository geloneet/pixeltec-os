// Utilidad compartida cliente/servidor — vivía en ia-templates.ts, pero ese
// archivo ahora es 'use server' (solo puede exportar funciones async), y
// IATemplateEditor la necesita de forma síncrona en el cliente.
export function extractVariables(content: string): string[] {
  const matches = content.match(/\{\{([^}]+)\}\}/g) ?? [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "").trim()))];
}
