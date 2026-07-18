/**
 * `CAPABILITY_RENDER_MAP` — espejo id → componente React real de las 4
 * Signature Capabilities certificadas (`SIGNATURE_CAPABILITIES`, F6C-T1).
 * `PageRenderer` (F6C-T5) lo usa para materializar cada nodo `kind:
 * "capability"` ya validado por `validatePageTree` (F6C-T2). La IA nunca elige
 * un componente: elige un `CapabilityId` certificado y este mapa lo resuelve.
 * Es el mismo molde que `render/blocks/index.ts` (RENDER_MAP), aplicado a la
 * capa de capabilities.
 *
 * NOTA DE TIPOS (T2 review finding, aplica igual a `BlockId`/`RENDER_MAP`):
 * `CapabilityId` deriva de `CAPABILITY_IDS = SIGNATURE_CAPABILITIES.filter(...)
 * .map((c) => c.id)`, que TypeScript infiere como `string[]` (el campo `id` de
 * `SignatureCapabilityDefinition` es `string`, no un literal). Por lo tanto
 * `CapabilityId` es estructuralmente `string` y `Record<CapabilityId,
 * ComponentType<any>>` NO exige en tiempo de compilación que estén las 4
 * claves — un `Record<string, X>` acepta cualquier subconjunto de claves de
 * string sin error. La barrera real de completitud es el test de paridad en
 * tiempo de ejecución (`capabilities.test.tsx`), que itera
 * `CAPABILITY_IDS` real y confirma que cada uno tiene un componente en este
 * mapa (y viceversa) — no el sistema de tipos.
 */
import type { ComponentType } from "react";
import type { CapabilityId } from "@/lib/pixelforge/registry/capabilities";
import { ComparisonTable } from "./ComparisonTable";
import { CoverageMap } from "./CoverageMap";
import { ProcessVisualizer } from "./ProcessVisualizer";
import { ProductSelector } from "./ProductSelector";

/**
 * Props ya validadas por T2 contra `capability.propsSchema`; cada capability
 * declara su propia forma tipada. El mapa es deliberadamente laxo (`any`)
 * porque une componentes con shapes de props distintos bajo una sola tabla —
 * la barrera de tipos real es `capability.propsSchema`.
 */
export type CapabilityComponent = ComponentType<any>;

export const CAPABILITY_RENDER_MAP: Record<CapabilityId, CapabilityComponent> = {
  "coverage-map-v1": CoverageMap,
  "comparison-table-v1": ComparisonTable,
  "product-selector-v1": ProductSelector,
  "process-visualizer-v1": ProcessVisualizer,
};
