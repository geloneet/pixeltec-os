/**
 * `RENDER_MAP` — espejo id → componente React real del catálogo de blocks
 * (`PIXELFORGE_BLOCKS`, T3). `PageRenderer` lo usa para materializar cada nodo
 * ya validado por `validatePageTree` (T4). La IA nunca elige un componente:
 * elige un `BlockId` del catálogo y este mapa lo resuelve.
 *
 * F6A-T5 aporta SOLO los 4 blocks núcleo; T6 completa los 8 restantes. Por eso
 * el tipo es `Partial<Record<BlockId, …>>`: hoy faltan claves a propósito. El
 * test de PARIDAD TOTAL (los 12 presentes) llega en T6; aquí sólo se asegura
 * que los 4 núcleo existen. `PageRenderer` maneja con gracia un id sin
 * componente (placeholder neutro) por si un árbol referencia un block aún no
 * implementado.
 */
import type { ComponentType } from "react";
import type { BlockId } from "@/lib/pixelforge/registry/blocks";
import { HeroSplit } from "./HeroSplit";
import { CtaBanner } from "./CtaBanner";
import { FeatureGrid } from "./FeatureGrid";
import { FooterContact } from "./FooterContact";

/**
 * Props ya validadas por T4; cada block declara su propia forma tipada. El mapa
 * es deliberadamente laxo (`any`) porque une componentes con shapes de props
 * distintos bajo una sola tabla — la barrera de tipos real es `def.propsSchema`.
 */
export type BlockComponent = ComponentType<any>;

export const RENDER_MAP: Partial<Record<BlockId, BlockComponent>> = {
  "hero-split": HeroSplit,
  "cta-banner": CtaBanner,
  "feature-grid": FeatureGrid,
  "footer-contact": FooterContact,
};
