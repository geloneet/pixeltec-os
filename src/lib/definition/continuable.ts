/**
 * Elige, de una lista de definiciones, cuál ofrecer para "Continuar" en la
 * ficha del cliente: la más reciente entre las que no están `completed`.
 * Puro, sin dependencias de DB — reusable en componentes cliente y tests.
 */
export interface ContinuableDefinition {
  id: string;
  status: "draft" | "in_progress" | "completed";
  updatedAt: Date;
}

export function pickContinuableDefinition<T extends ContinuableDefinition>(
  definitions: T[]
): T | null {
  const unfinished = definitions.filter((d) => d.status !== "completed");
  if (unfinished.length === 0) return null;
  return unfinished.reduce((latest, d) =>
    d.updatedAt.getTime() > latest.updatedAt.getTime() ? d : latest
  );
}
