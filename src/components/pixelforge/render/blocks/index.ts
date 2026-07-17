/**
 * `RENDER_MAP` — espejo id → componente React real del catálogo de blocks
 * (`PIXELFORGE_BLOCKS`, T3). `PageRenderer` lo usa para materializar cada nodo
 * ya validado por `validatePageTree` (T4). La IA nunca elige un componente:
 * elige un `BlockId` del catálogo y este mapa lo resuelve.
 *
 * F6A-T5 aportó los 4 blocks núcleo; F6A-T6 completa los 8 restantes y cierra
 * la PARIDAD TOTAL: el mapa cubre ahora los 12 `BlockId` del registry. Por eso
 * el tipo pasa de `Partial<Record<…>>` a `Record<BlockId, …>` COMPLETO —
 * TypeScript exige que no falte ninguna clave (barrera de tipos + test de
 * paridad `blocks.test.tsx`). `PageRenderer` conserva su placeholder neutro por
 * robustez, pero con la paridad cerrada ya no debería activarse en un árbol
 * válido.
 */
import type { ComponentType } from "react";
import type { BlockId } from "@/lib/pixelforge/registry/blocks";
import { HeroSplit } from "./HeroSplit";
import { CtaBanner } from "./CtaBanner";
import { FeatureGrid } from "./FeatureGrid";
import { FooterContact } from "./FooterContact";
import { HeroEditorial } from "./HeroEditorial";
import { ProofLogos } from "./ProofLogos";
import { OfferTiers } from "./OfferTiers";
import { NarrativeScroller } from "./NarrativeScroller";
import { FaqAccordion } from "./FaqAccordion";
import { TestimonialQuote } from "./TestimonialQuote";
import { ProcessSteps } from "./ProcessSteps";
import { StatsBand } from "./StatsBand";

/**
 * Props ya validadas por T4; cada block declara su propia forma tipada. El mapa
 * es deliberadamente laxo (`any`) porque une componentes con shapes de props
 * distintos bajo una sola tabla — la barrera de tipos real es `def.propsSchema`.
 */
export type BlockComponent = ComponentType<any>;

export const RENDER_MAP: Record<BlockId, BlockComponent> = {
  "hero-split": HeroSplit,
  "hero-editorial": HeroEditorial,
  "proof-logos": ProofLogos,
  "offer-tiers": OfferTiers,
  "narrative-scroller": NarrativeScroller,
  "faq-accordion": FaqAccordion,
  "testimonial-quote": TestimonialQuote,
  "cta-banner": CtaBanner,
  "feature-grid": FeatureGrid,
  "process-steps": ProcessSteps,
  "stats-band": StatsBand,
  "footer-contact": FooterContact,
};
