import { describe, expect, it } from "vitest";
import type { ValidatedPageTree, ValidatedPageNode } from "@/lib/pixelforge/registry/validate-page-tree";
import { checkVI008, checkVI009, checkMO004, checkMO006, checkCA001, checkCA005, checkTE009 } from "./heuristics";

function node(overrides: Partial<ValidatedPageNode> = {}): ValidatedPageNode {
  return {
    nodeId: "n1",
    componentId: "feature-grid",
    kind: "block",
    variant: "3-col",
    orden: 1,
    props: {},
    ...overrides,
  };
}

function tree(nodes: ValidatedPageNode[]): ValidatedPageTree {
  return { nodes, notas: "fixture de test" };
}

describe("checkVI008 — copy vs límites por slot", () => {
  it("hero title > 90 chars produce finding", () => {
    const largo = "T".repeat(91);
    const t = tree([node({ nodeId: "hero", componentId: "hero-split", props: { titulo: largo } })]);
    const findings = checkVI008(t);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.checkCode).toBe("QA-VI-008");
    expect(findings[0]!.location).toEqual({ nodeId: "hero", slot: "titulo" });
  });

  it("hero title <= 90 chars no produce finding", () => {
    const t = tree([node({ nodeId: "hero", componentId: "hero-split", props: { titulo: "T".repeat(90) } })]);
    expect(checkVI008(t)).toEqual([]);
  });

  it("cta.label > 32 chars produce finding (slot cta.label)", () => {
    const t = tree([
      node({
        nodeId: "cta1",
        componentId: "cta-banner",
        props: { cta: { label: "L".repeat(33), href: "/x" } },
      }),
    ]);
    const findings = checkVI008(t);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.location).toEqual({ nodeId: "cta1", slot: "cta.label" });
  });

  it("ctaLabel plano (offer-tiers) > 32 chars produce finding", () => {
    const t = tree([
      node({
        nodeId: "offer1",
        componentId: "offer-tiers",
        props: { tiers: [{ ctaLabel: "L".repeat(40) }] },
      }),
    ]);
    const findings = checkVI008(t);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.location).toEqual({ nodeId: "offer1", slot: "tiers.0.ctaLabel" });
  });

  it("cualquier otro string > 600 chars produce finding de párrafo", () => {
    const t = tree([node({ nodeId: "faq1", componentId: "faq-accordion", props: { items: [{ respuesta: "R".repeat(601) }] } })]);
    const findings = checkVI008(t);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.description).toContain("601");
  });

  it("un árbol sin violaciones no produce findings", () => {
    const t = tree([node({ nodeId: "n1", componentId: "feature-grid", props: { titulo: "Corto", features: [{ titulo: "a", texto: "b" }] } })]);
    expect(checkVI008(t)).toEqual([]);
  });
});

describe("checkVI009 — ítems bajo el mínimo por block", () => {
  it("feature-grid con 1 feature (< min 2) produce finding", () => {
    const t = tree([node({ nodeId: "n1", componentId: "feature-grid", props: { features: [{ titulo: "a" }] } })]);
    const findings = checkVI009(t);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.description).toContain("1 ítems");
  });

  it("proof-logos con 2 logos (< min 3) produce finding", () => {
    const t = tree([node({ nodeId: "n1", componentId: "proof-logos", props: { logos: [{ nombre: "a" }, { nombre: "b" }] } })]);
    expect(checkVI009(t)).toHaveLength(1);
  });

  it("feature-grid con 3 features (>= min) no produce finding", () => {
    const t = tree([
      node({ nodeId: "n1", componentId: "feature-grid", props: { features: [{ titulo: "a" }, { titulo: "b" }, { titulo: "c" }] } }),
    ]);
    expect(checkVI009(t)).toEqual([]);
  });

  it("un block sin mínimo declarado (p.ej. hero-split) no se evalúa", () => {
    const t = tree([node({ nodeId: "n1", componentId: "hero-split", props: {} })]);
    expect(checkVI009(t)).toEqual([]);
  });
});

describe("checkMO004 — formato de count-up que el parser puede degradar", () => {
  it("stats con '1,250' (separador de millares) produce finding", () => {
    const t = tree([node({ nodeId: "stats1", componentId: "stats-band", props: { stats: [{ valor: "1,250", etiqueta: "clientes" }] } })]);
    const findings = checkMO004(t);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.checkCode).toBe("QA-MO-004");
    expect(findings[0]!.location).toEqual({ nodeId: "stats1", slot: "stats.0.valor" });
  });

  it("stats con '8 años' o '98%' (numérico simple con sufijo) NO produce finding", () => {
    const t = tree([
      node({
        nodeId: "stats1",
        componentId: "stats-band",
        props: {
          stats: [
            { valor: "8 años", etiqueta: "en el mercado" },
            { valor: "98%", etiqueta: "satisfacción" },
          ],
        },
      }),
    ]);
    expect(checkMO004(t)).toEqual([]);
  });

  it("stats sin ningún dígito ('N/A') produce finding", () => {
    const t = tree([node({ nodeId: "stats1", componentId: "stats-band", props: { stats: [{ valor: "N/A", etiqueta: "x" }] } })]);
    expect(checkMO004(t)).toHaveLength(1);
  });

  it("stats con dos puntos decimales ('1.234.567') produce finding", () => {
    const t = tree([node({ nodeId: "stats1", componentId: "stats-band", props: { stats: [{ valor: "1.234.567", etiqueta: "x" }] } })]);
    expect(checkMO004(t)).toHaveLength(1);
  });

  it("blocks distintos de stats-band no se evalúan", () => {
    const t = tree([node({ nodeId: "n1", componentId: "feature-grid", props: { stats: [{ valor: "N/A" }] } })]);
    expect(checkMO004(t)).toEqual([]);
  });
});

describe("checkMO006 — secuencia estimada demasiado larga / cinematográficos contiguos", () => {
  it("una sequence semantic con order alto y duración slow supera el presupuesto de 2.5s", () => {
    const t = tree([
      node({
        nodeId: "n1",
        componentId: "cta-banner",
        choreography: {
          narrativePurpose: "x",
          motifConnection: "x",
          reducedMotionFallback: "x",
          sequences: [
            {
              behaviorId: "wipe-reveal",
              targetSlot: "titulo",
              trigger: "in-view",
              order: 15,
              durationToken: "slow",
              delayStrategy: "semantic",
              intensity: 3,
            },
          ],
        },
      }),
    ]);
    const findings = checkMO006(t);
    expect(findings.some((f) => f.description.includes("delay+duración"))).toBe(true);
  });

  it("una sequence fast/none con order bajo no supera el presupuesto", () => {
    const t = tree([
      node({
        nodeId: "n1",
        componentId: "faq-accordion",
        choreography: {
          narrativePurpose: "x",
          motifConnection: "x",
          reducedMotionFallback: "x",
          sequences: [
            { behaviorId: "fade-in", targetSlot: "items", trigger: "in-view", order: 0, durationToken: "fast", delayStrategy: "none", intensity: 1 },
          ],
        },
      }),
    ]);
    expect(checkMO006(t)).toEqual([]);
  });

  it("3 nodos cinematográficos contiguos (>2) producen un finding de contiguos", () => {
    const cinematicSeq = (targetSlot: string) => ({
      behaviorId: "wipe-reveal",
      targetSlot,
      trigger: "load" as const,
      order: 0,
      durationToken: "fast" as const,
      delayStrategy: "none" as const,
      intensity: 3 as const,
    });
    const cinematicChoreography = (slot: string) => ({
      narrativePurpose: "x",
      motifConnection: "x",
      reducedMotionFallback: "x",
      sequences: [cinematicSeq(slot)],
    });

    const t = tree([
      node({ nodeId: "n1", componentId: "hero-split", orden: 1, choreography: cinematicChoreography("titulo") }),
      node({ nodeId: "n2", componentId: "narrative-scroller", orden: 2, choreography: cinematicChoreography("pasos") }),
      node({ nodeId: "n3", componentId: "cta-banner", orden: 3, choreography: cinematicChoreography("titulo") }),
    ]);

    const findings = checkMO006(t);
    expect(findings.some((f) => f.description.includes("nodos cinematográficos consecutivos"))).toBe(true);
  });

  it("2 nodos cinematográficos contiguos (el máximo permitido) NO produce el finding de contiguos", () => {
    const cinematicChoreography = {
      narrativePurpose: "x",
      motifConnection: "x",
      reducedMotionFallback: "x",
      sequences: [
        { behaviorId: "wipe-reveal", targetSlot: "titulo", trigger: "load" as const, order: 0, durationToken: "fast" as const, delayStrategy: "none" as const, intensity: 3 as const },
      ],
    };
    const t = tree([
      node({ nodeId: "n1", componentId: "hero-split", orden: 1, choreography: cinematicChoreography }),
      node({ nodeId: "n2", componentId: "cta-banner", orden: 2, choreography: cinematicChoreography }),
    ]);
    expect(checkMO006(t).some((f) => f.description.includes("consecutivos"))).toBe(false);
  });

  it("un árbol sin choreography no produce findings", () => {
    const t = tree([node({ nodeId: "n1" })]);
    expect(checkMO006(t)).toEqual([]);
  });
});

describe("checkCA001 — datos mínimos de una capability", () => {
  it("product-selector-v1 con 1 opción (< min 2) produce finding", () => {
    const t = tree([
      node({ nodeId: "sel1", componentId: "product-selector-v1", kind: "capability", variant: "default", props: { opciones: [{ id: "a", nombre: "A" }] } }),
    ]);
    const findings = checkCA001(t);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe("major");
    expect(findings[0]!.blocking).toBe(false);
  });

  it("product-selector-v1 con 2 opciones no produce finding", () => {
    const t = tree([
      node({
        nodeId: "sel1",
        componentId: "product-selector-v1",
        kind: "capability",
        variant: "default",
        props: { opciones: [{ id: "a", nombre: "A" }, { id: "b", nombre: "B" }] },
      }),
    ]);
    expect(checkCA001(t)).toEqual([]);
  });

  it("nodos block (kind !== capability) no se evalúan", () => {
    const t = tree([node({ nodeId: "n1", componentId: "feature-grid", kind: "block", props: { opciones: [{ id: "a" }] } })]);
    expect(checkCA001(t)).toEqual([]);
  });
});

describe("checkCA005 — fallbackComponentId de una capability usada", () => {
  it("las 4 capabilities certificadas actuales no producen finding (fallback siempre registrado)", () => {
    const t = tree([
      node({ nodeId: "n1", componentId: "coverage-map-v1", kind: "capability", variant: "default", props: {} }),
      node({ nodeId: "n2", componentId: "comparison-table-v1", kind: "capability", variant: "default", props: {} }),
      node({ nodeId: "n3", componentId: "product-selector-v1", kind: "capability", variant: "default", props: {} }),
      node({ nodeId: "n4", componentId: "process-visualizer-v1", kind: "capability", variant: "default", props: {} }),
    ]);
    expect(checkCA005(t)).toEqual([]);
  });

  it("un árbol sin capabilities no produce findings", () => {
    const t = tree([node({ nodeId: "n1", componentId: "feature-grid", kind: "block" })]);
    expect(checkCA005(t)).toEqual([]);
  });
});

describe("checkTE009 — href inseguro en props (defensa en profundidad)", () => {
  it("un href javascript: en cualquier profundidad de props produce finding critical/blocking", () => {
    const t = tree([
      node({ nodeId: "n1", componentId: "footer-contact", props: { links: [{ label: "x", href: "javascript:alert(1)" }] } }),
    ]);
    const findings = checkTE009(t);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe("critical");
    expect(findings[0]!.blocking).toBe(true);
    expect(findings[0]!.location).toEqual({ nodeId: "n1", slot: "links.0.href" });
  });

  it("hrefs seguros (/, #, https://) no producen finding", () => {
    const t = tree([
      node({
        nodeId: "n1",
        componentId: "cta-banner",
        props: { cta: { label: "Ir", href: "/contacto" } },
      }),
      node({ nodeId: "n2", componentId: "hero-editorial", props: { cta: { label: "Ir", href: "https://pixeltec.mx" } } }),
    ]);
    expect(checkTE009(t)).toEqual([]);
  });
});
