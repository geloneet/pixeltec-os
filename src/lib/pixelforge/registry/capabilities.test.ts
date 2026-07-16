import { describe, expect, it } from "vitest";
import {
  CAPABILITY_IDS,
  SIGNATURE_CAPABILITIES,
  SIGNATURE_CAPABILITY_CATEGORIES,
  getCapabilitiesForPrompt,
  isCertifiedCapabilityId,
} from "./capabilities";

describe("SIGNATURE_CAPABILITIES", () => {
  it("tiene exactamente 4 entradas certificadas v1", () => {
    expect(SIGNATURE_CAPABILITIES).toHaveLength(4);
  });

  it("tiene ids únicos", () => {
    const ids = SIGNATURE_CAPABILITIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cada categoría está dentro de las 8 categorías del plan maestro", () => {
    for (const capability of SIGNATURE_CAPABILITIES) {
      expect(SIGNATURE_CAPABILITY_CATEGORIES).toContain(capability.category);
    }
  });

  it("cubre exactamente las 4 categorías certificadas (coverage-map, comparison, selector, process-visualizer)", () => {
    const categories = SIGNATURE_CAPABILITIES.map((c) => c.category).sort();
    expect(categories).toEqual(["comparison", "coverage-map", "process-visualizer", "selector"].sort());
  });

  it("cada entrada tiene fallbackComponentId no vacío", () => {
    for (const capability of SIGNATURE_CAPABILITIES) {
      expect(capability.fallbackComponentId.length).toBeGreaterThan(0);
    }
  });

  it("cada entrada tiene propsSchema Zod válido, dataRequirements y accessibilityRequirements no vacíos", () => {
    for (const capability of SIGNATURE_CAPABILITIES) {
      expect(typeof capability.propsSchema.safeParse).toBe("function");
      expect(capability.dataRequirements.length).toBeGreaterThan(0);
      expect(capability.accessibilityRequirements.length).toBeGreaterThan(0);
      expect(capability.supportedIndustries.length).toBeGreaterThan(0);
      expect(["low", "medium", "high"]).toContain(capability.performanceCost);
    }
  });

  it("SIGNATURE_CAPABILITY_CATEGORIES tiene 8 valores", () => {
    expect(SIGNATURE_CAPABILITY_CATEGORIES).toHaveLength(8);
  });
});

describe("CAPABILITY_IDS / isCertifiedCapabilityId", () => {
  it("CAPABILITY_IDS deriva 1:1 de SIGNATURE_CAPABILITIES", () => {
    expect(CAPABILITY_IDS).toEqual(SIGNATURE_CAPABILITIES.map((c) => c.id));
  });

  it("reconoce un id certificado", () => {
    expect(isCertifiedCapabilityId("coverage-map-v1")).toBe(true);
  });

  it("rechaza un id inexistente", () => {
    expect(isCertifiedCapabilityId("calculator-v1")).toBe(false);
  });
});

describe("getCapabilitiesForPrompt", () => {
  it("devuelve texto en español con id, categoría y datos requeridos de cada capability", () => {
    const text = getCapabilitiesForPrompt();
    for (const capability of SIGNATURE_CAPABILITIES) {
      expect(text).toContain(capability.id);
      expect(text).toContain(capability.category);
    }
    expect(text.length).toBeGreaterThan(0);
  });
});
