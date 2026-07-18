import { describe, expect, it } from "vitest";
import { BLOCK_IDS } from "./blocks";
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

  it("incluye una línea 'Propósito: <purpose>' por cada capability", () => {
    const text = getCapabilitiesForPrompt();
    for (const capability of SIGNATURE_CAPABILITIES) {
      expect(text).toContain(`Propósito: ${capability.purpose}`);
    }
  });
});

describe("SIGNATURE_CAPABILITIES — extensión aditiva F6C (D3)", () => {
  it("cada entrada tiene version: 1", () => {
    for (const capability of SIGNATURE_CAPABILITIES) {
      expect(capability.version).toBe(1);
    }
  });

  it("cada entrada tiene purpose (propósito de negocio) no vacío", () => {
    for (const capability of SIGNATURE_CAPABILITIES) {
      expect(typeof capability.purpose).toBe("string");
      expect(capability.purpose.length).toBeGreaterThan(0);
    }
  });

  it("cada entrada tiene al menos 3 acceptanceCriteria concretos", () => {
    for (const capability of SIGNATURE_CAPABILITIES) {
      expect(capability.acceptanceCriteria.length).toBeGreaterThanOrEqual(3);
      for (const criterio of capability.acceptanceCriteria) {
        expect(criterio.length).toBeGreaterThan(0);
      }
    }
  });

  it("las 4 entradas certificadas v1 tienen certification: 'certified'", () => {
    for (const capability of SIGNATURE_CAPABILITIES) {
      expect(capability.certification).toBe("certified");
    }
  });

  it("las 4 entradas tienen allowsChoreography: false", () => {
    for (const capability of SIGNATURE_CAPABILITIES) {
      expect(capability.allowsChoreography).toBe(false);
    }
  });

  it("fallbackComponentId de cada capability es un BlockId real registrado (D2)", () => {
    for (const capability of SIGNATURE_CAPABILITIES) {
      expect(BLOCK_IDS).toContain(capability.fallbackComponentId);
    }
  });

  it("remap D2 exacto: process-visualizer→process-steps, comparison→offer-tiers, selector→feature-grid, coverage-map→feature-grid", () => {
    const byId = Object.fromEntries(SIGNATURE_CAPABILITIES.map((c) => [c.id, c.fallbackComponentId]));
    expect(byId["process-visualizer-v1"]).toBe("process-steps");
    expect(byId["comparison-table-v1"]).toBe("offer-tiers");
    expect(byId["product-selector-v1"]).toBe("feature-grid");
    expect(byId["coverage-map-v1"]).toBe("feature-grid");
  });
});

describe("CAPABILITY_IDS / BLOCK_IDS — disjunción de namespaces", () => {
  it("CAPABILITY_IDS y BLOCK_IDS no comparten ningún id", () => {
    const overlap = CAPABILITY_IDS.filter((id) => (BLOCK_IDS as readonly string[]).includes(id));
    expect(overlap).toEqual([]);
  });
});

describe("coverage-map-v1 propsSchema — extensión aditiva D4", () => {
  const coverageMap = SIGNATURE_CAPABILITIES.find((c) => c.id === "coverage-map-v1")!;

  it("acepta zonas con codigosPostales y mensajeFueraDeCobertura (forma nueva)", () => {
    const result = coverageMap.propsSchema.safeParse({
      zonas: [{ nombre: "Puerto Vallarta", poligonoOrRadio: "centro + 10km", codigosPostales: ["48300", "48310"] }],
      mensajeFueraDeCobertura: "Aún no damos servicio en tu zona.",
    });
    expect(result.success).toBe(true);
  });

  it("sigue aceptando zonas SIN codigosPostales ni mensajeFueraDeCobertura (retrocompat)", () => {
    const result = coverageMap.propsSchema.safeParse({
      zonas: [{ nombre: "Puerto Vallarta", poligonoOrRadio: "centro + 10km" }],
    });
    expect(result.success).toBe(true);
  });

  it("rechaza codigosPostales con string vacío", () => {
    const result = coverageMap.propsSchema.safeParse({
      zonas: [{ nombre: "Puerto Vallarta", poligonoOrRadio: "centro + 10km", codigosPostales: [""] }],
    });
    expect(result.success).toBe(false);
  });
});
