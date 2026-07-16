/**
 * Contrato PREPARADO (condición 1 del Gate 0) para el modo two-step de
 * `compose_page_tree`: si el single-shot (`OPERATION_SPECS.compose_page_tree`,
 * ver `../../schemas/index.ts`) falla sistemáticamente por `max_tokens` o
 * `schema_too_complex` (taxonomía en `../failures.ts`), la salida se separa
 * en dos llamadas — paso 1 genera solo la ESTRUCTURA de nodos (sin props,
 * schema más chico), paso 2 rellena las props por LOTES de nodos (fan-out,
 * cada lote es un schema acotado).
 *
 * Estado: `prepared-not-active` — solo tipos y criterios de activación, CERO
 * lógica de ejecución. Se activa recién si el single-shot demuestra el
 * problema que este contrato resuelve (ver `COMPOSE_TWO_STEP_ACTIVATION`).
 */

/** Paso 1: el árbol de nodos de la página, SIN props — solo tipo, id y jerarquía. */
export interface ComposeStepOneOutput {
  nodes: ComposeStepOneNode[];
}

export interface ComposeStepOneNode {
  id: string;
  type: string;
  children: ComposeStepOneNode[];
}

/** Paso 2: input de un LOTE de nodos (por id) que necesitan sus props resueltas. */
export interface ComposeStepTwoBatchInput {
  nodeIds: string[];
}

/** Paso 2: props resueltas para cada nodo del lote pedido. */
export interface ComposeStepTwoBatchOutput {
  props: Record<string, Record<string, unknown>>;
}

export const COMPOSE_TWO_STEP_ACTIVATION = {
  criteria: ["single-shot falla con max_tokens", "single-shot falla con schema_too_complex"],
  status: "prepared-not-active",
} as const;
