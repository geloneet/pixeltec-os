import { describe, expect, it } from "vitest";
import { validatePageTree } from "./validate-page-tree";

/** Props mínimas válidas de coverage-map-v1 (única certificada usada en esta suite de capabilities). */
const COVERAGE_MAP_PROPS = {
  zonas: [{ nombre: "Puerto Vallarta", poligonoOrRadio: "10km desde el centro" }],
};

/** Nodo capability válido (variant "default", propsJson serializado, sin choreography). */
function capabilityNode(overrides: Record<string, unknown> = {}) {
  return {
    nodeId: "cap-1",
    componentId: "coverage-map-v1",
    variant: "default",
    orden: 4,
    propsJson: JSON.stringify(COVERAGE_MAP_PROPS),
    ...overrides,
  };
}

/**
 * Fixtures mínimas válidas por componentId — mismas formas que
 * `blocks.test.ts` pero solo para los ids que usa esta suite.
 */
const HERO_SPLIT_PROPS = {
  titulo: "Plomería de emergencia 24/7",
  subtitulo: "Llegamos en menos de 40 minutos a toda la CDMX",
  cta: { label: "Solicitar servicio", href: "/contacto" },
  mediaAlt: "Técnico reparando una tubería en cocina",
  badges: ["24/7", "Garantía 90 días"],
};

const FEATURE_GRID_PROPS = {
  titulo: "Todo lo que necesitas",
  features: [
    { titulo: "Rápido", texto: "Respuesta en menos de una hora.", icono: "zap" },
    { titulo: "Seguro", texto: "Técnicos certificados." },
    { titulo: "Garantizado", texto: "90 días de garantía por escrito." },
  ],
};

const CTA_BANNER_PROPS = {
  titulo: "¿Listo para empezar?",
  subtitulo: "Agenda tu diagnóstico gratuito hoy mismo.",
  cta: { label: "Agendar ahora", href: "https://wa.me/5215500000000" },
};

const FOOTER_CONTACT_PROPS = {
  empresa: "PIXELTEC.MX",
  telefono: "+52 55 0000 0000",
  links: [{ label: "Aviso de privacidad", href: "/privacidad" }],
};

/** Construye un nodo válido; permite overrides parciales a nivel del nodo del schema shape. */
function node(overrides: Record<string, unknown> = {}) {
  return {
    nodeId: "n1",
    componentId: "hero-split",
    variant: "media-right",
    orden: 1,
    propsJson: JSON.stringify(HERO_SPLIT_PROPS),
    ...overrides,
  };
}

/** Árbol válido de referencia: 3 nodos, sin choreography. */
function validTree() {
  return {
    notas: "Landing de plomería de emergencia.",
    nodes: [
      node({ nodeId: "hero-1", componentId: "hero-split", variant: "media-right", orden: 1, propsJson: JSON.stringify(HERO_SPLIT_PROPS) }),
      node({ nodeId: "features-1", componentId: "feature-grid", variant: "3-col", orden: 2, propsJson: JSON.stringify(FEATURE_GRID_PROPS) }),
      node({ nodeId: "footer-1", componentId: "footer-contact", variant: "default", orden: 3, propsJson: JSON.stringify(FOOTER_CONTACT_PROPS) }),
    ],
  };
}

/** Coreografía válida de referencia sobre hero-split (allowsCinematic: true). */
function validChoreography(overrides: Record<string, unknown> = {}) {
  return {
    narrativePurpose: "Anclar la promesa de urgencia desde el primer scroll.",
    motifConnection: "El motif es 'respuesta inmediata' — el hero revela el CTA con la misma velocidad.",
    reducedMotionFallback: "Mostrar todo estático, sin animación.",
    sequences: [
      {
        behaviorId: "fade-rise",
        targetSlot: "titulo",
        trigger: "load",
        order: 0,
        durationToken: "normal",
        delayStrategy: "none",
        intensity: 1,
      },
    ],
    ...overrides,
  };
}

describe("validatePageTree — árbol válido", () => {
  it("acepta un árbol completo válido y devuelve ok:true con tree y warnings vacíos", () => {
    const result = validatePageTree(validTree());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok:true");
    expect(result.tree.nodes).toHaveLength(3);
    expect(result.tree.notas).toBe("Landing de plomería de emergencia.");
    expect(result.warnings).toEqual([]);
    const heroNode = result.tree.nodes.find((n) => n.nodeId === "hero-1");
    expect(heroNode?.componentId).toBe("hero-split");
    expect(heroNode?.props).toEqual(HERO_SPLIT_PROPS);
  });

  it("rechaza un input que no cumple el shape base (menos de 3 nodos)", () => {
    const tree = validTree();
    tree.nodes = tree.nodes.slice(0, 2);
    const result = validatePageTree(tree);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rechaza input que no es ni siquiera un objeto", () => {
    const result = validatePageTree("no soy un árbol");
    expect(result.ok).toBe(false);
  });
});

describe("validatePageTree — errores por nodo", () => {
  it("componentId desconocido produce error nombrando el nodeId", () => {
    const tree = validTree();
    tree.nodes[0] = node({ nodeId: "hero-1", componentId: "hero-parallax-3000", orden: 1 });
    const result = validatePageTree(tree);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");
    expect(result.errors.some((e) => e.includes("hero-1") && e.includes("hero-parallax-3000"))).toBe(true);
  });

  it("variant inválida produce error nombrando el nodeId", () => {
    const tree = validTree();
    tree.nodes[0] = node({
      nodeId: "hero-1",
      componentId: "hero-split",
      variant: "media-explosion",
      orden: 1,
      propsJson: JSON.stringify(HERO_SPLIT_PROPS),
    });
    const result = validatePageTree(tree);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");
    expect(result.errors.some((e) => e.includes("hero-1") && e.includes("media-explosion"))).toBe(true);
  });

  it("propsJson malformado (no parseable) produce el error exacto 'propsJson inválido en <nodeId>'", () => {
    const tree = validTree();
    tree.nodes[0] = node({ nodeId: "hero-1", componentId: "hero-split", orden: 1, propsJson: "{not valid json" });
    const result = validatePageTree(tree);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");
    expect(result.errors.some((e) => e.includes("propsJson inválido en hero-1"))).toBe(true);
  });

  it("props que violan el propsSchema del block producen error nombrando el nodeId", () => {
    const tree = validTree();
    tree.nodes[0] = node({
      nodeId: "hero-1",
      componentId: "hero-split",
      orden: 1,
      propsJson: JSON.stringify({ titulo: "Solo título, falta todo lo demás" }),
    });
    const result = validatePageTree(tree);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");
    expect(result.errors.some((e) => e.includes("hero-1"))).toBe(true);
  });

  it("targetSlot inexistente en editableSlots produce error nombrando el nodeId", () => {
    const tree = validTree();
    tree.nodes[0] = node({
      nodeId: "hero-1",
      componentId: "hero-split",
      orden: 1,
      propsJson: JSON.stringify(HERO_SPLIT_PROPS),
      choreography: validChoreography({
        sequences: [
          {
            behaviorId: "fade-rise",
            targetSlot: "campoQueNoExiste",
            trigger: "load",
            order: 0,
            durationToken: "normal",
            delayStrategy: "none",
            intensity: 1,
          },
        ],
      }),
    });
    const result = validatePageTree(tree);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");
    expect(result.errors.some((e) => e.includes("hero-1") && e.includes("campoQueNoExiste"))).toBe(true);
  });

  it("intensity 3 en un block sin allowsCinematic produce error nombrando el nodeId", () => {
    const tree = validTree();
    // feature-grid: allowsCinematic === false
    tree.nodes[1] = node({
      nodeId: "features-1",
      componentId: "feature-grid",
      variant: "3-col",
      orden: 2,
      propsJson: JSON.stringify(FEATURE_GRID_PROPS),
      choreography: validChoreography({
        sequences: [
          {
            behaviorId: "fade-rise",
            targetSlot: "titulo",
            trigger: "load",
            order: 0,
            durationToken: "normal",
            delayStrategy: "none",
            intensity: 3,
          },
        ],
      }),
    });
    const result = validatePageTree(tree);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");
    expect(result.errors.some((e) => e.includes("features-1"))).toBe(true);
  });

  it("acepta intensity 3 en un block con allowsCinematic (hero-split)", () => {
    const tree = validTree();
    tree.nodes[0] = node({
      nodeId: "hero-1",
      componentId: "hero-split",
      orden: 1,
      propsJson: JSON.stringify(HERO_SPLIT_PROPS),
      choreography: validChoreography({
        sequences: [
          {
            behaviorId: "fade-rise",
            targetSlot: "titulo",
            trigger: "load",
            order: 0,
            durationToken: "normal",
            delayStrategy: "none",
            intensity: 3,
          },
        ],
      }),
    });
    const result = validatePageTree(tree);
    expect(result.ok).toBe(true);
  });
});

describe("validatePageTree — límite global de nodos cinematográficos", () => {
  function cinematicNode(nodeId: string, orden: number) {
    return node({
      nodeId,
      componentId: "hero-split",
      variant: "media-right",
      orden,
      propsJson: JSON.stringify(HERO_SPLIT_PROPS),
      choreography: validChoreography({
        sequences: [
          {
            behaviorId: "fade-rise",
            targetSlot: "titulo",
            trigger: "load",
            order: 0,
            durationToken: "normal",
            delayStrategy: "none",
            intensity: 3,
          },
        ],
      }),
    });
  }

  it("permite hasta 3 nodos con alguna sequence intensity 3", () => {
    const tree = {
      notas: "3 nodos cinematográficos, todavía dentro del límite.",
      nodes: [cinematicNode("c1", 1), cinematicNode("c2", 2), cinematicNode("c3", 3)],
    };
    const result = validatePageTree(tree);
    expect(result.ok).toBe(true);
  });

  it("rechaza 4 nodos con alguna sequence intensity 3", () => {
    const tree = {
      notas: "4 nodos cinematográficos, excede el límite.",
      nodes: [cinematicNode("c1", 1), cinematicNode("c2", 2), cinematicNode("c3", 3), cinematicNode("c4", 4)],
    };
    const result = validatePageTree(tree);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");
    expect(result.errors.some((e) => /cinemat/i.test(e))).toBe(true);
  });
});

describe("validatePageTree — orden duplicado (global)", () => {
  it("rechaza dos nodos con el mismo orden", () => {
    const tree = validTree();
    tree.nodes[1] = { ...tree.nodes[1], orden: tree.nodes[0].orden };
    const result = validatePageTree(tree);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");
    expect(result.errors.some((e) => e.includes("orden") && /duplicad/i.test(e))).toBe(true);
  });
});

describe("validatePageTree — behaviors (F6B-T2: validación real contra el registry)", () => {
  it("behaviorId desconocido produce error nombrando behaviorId y nodeId (ya no es warning)", () => {
    const tree = validTree();
    tree.nodes[0] = node({
      nodeId: "hero-1",
      componentId: "hero-split",
      orden: 1,
      propsJson: JSON.stringify(HERO_SPLIT_PROPS),
      choreography: validChoreography({
        sequences: [
          {
            behaviorId: "un-comportamiento-que-no-existe",
            targetSlot: "titulo",
            trigger: "load",
            order: 0,
            durationToken: "normal",
            delayStrategy: "none",
            intensity: 1,
          },
        ],
      }),
    });
    const result = validatePageTree(tree);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");
    expect(
      result.errors.some((e) => e.includes("un-comportamiento-que-no-existe") && e.includes("hero-1"))
    ).toBe(true);
  });

  it("trigger no permitido para el behavior produce error (count-up solo admite in-view, no load)", () => {
    const tree = validTree();
    tree.nodes[0] = node({
      nodeId: "stats-1",
      componentId: "stats-band",
      variant: "default",
      orden: 1,
      propsJson: JSON.stringify({
        stats: [
          { valor: "120+", etiqueta: "Proyectos entregados" },
          { valor: "98%", etiqueta: "Retención de clientes" },
        ],
      }),
      choreography: validChoreography({
        sequences: [
          {
            behaviorId: "count-up",
            targetSlot: "stats",
            trigger: "load",
            order: 0,
            durationToken: "normal",
            delayStrategy: "none",
            intensity: 1,
          },
        ],
      }),
    });
    const result = validatePageTree(tree);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");
    expect(result.errors.some((e) => e.includes("count-up") && e.includes("stats-1") && e.includes("load"))).toBe(true);
  });

  it("behavior incompatible con los motionIntents del block produce error (count-up en un hero)", () => {
    const tree = validTree();
    tree.nodes[0] = node({
      nodeId: "hero-1",
      componentId: "hero-split",
      orden: 1,
      propsJson: JSON.stringify(HERO_SPLIT_PROPS),
      choreography: validChoreography({
        sequences: [
          {
            behaviorId: "count-up",
            targetSlot: "titulo",
            trigger: "in-view",
            order: 0,
            durationToken: "normal",
            delayStrategy: "none",
            intensity: 1,
          },
        ],
      }),
    });
    const result = validatePageTree(tree);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");
    expect(result.errors.some((e) => e.includes("count-up") && e.includes("hero-1"))).toBe(true);
  });

  it("behavior cinematográfico (cinematicOnly) con intensity !== 3 produce error", () => {
    const tree = validTree();
    tree.nodes[0] = node({
      nodeId: "hero-1",
      componentId: "hero-split",
      orden: 1,
      propsJson: JSON.stringify(HERO_SPLIT_PROPS),
      choreography: validChoreography({
        sequences: [
          {
            behaviorId: "wipe-reveal",
            targetSlot: "titulo",
            trigger: "load",
            order: 0,
            durationToken: "normal",
            delayStrategy: "none",
            intensity: 2,
          },
        ],
      }),
    });
    const result = validatePageTree(tree);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");
    expect(result.errors.some((e) => e.includes("wipe-reveal") && e.includes("hero-1"))).toBe(true);
  });

  it("caso feliz: behavior real, trigger permitido, intent compatible y intensity acorde → ok:true sin warnings", () => {
    const tree = validTree();
    tree.nodes[0] = node({
      nodeId: "hero-1",
      componentId: "hero-split",
      orden: 1,
      propsJson: JSON.stringify(HERO_SPLIT_PROPS),
      choreography: validChoreography({
        sequences: [
          {
            behaviorId: "fade-rise",
            targetSlot: "titulo",
            trigger: "load",
            order: 0,
            durationToken: "normal",
            delayStrategy: "none",
            intensity: 1,
          },
        ],
      }),
    });
    const result = validatePageTree(tree);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok:true");
    expect(result.warnings).toEqual([]);
  });
});

describe("validatePageTree — accumula múltiples errores en una sola pasada (no corta en el primero)", () => {
  it("acumula errores de nodos y de tipos distintos simultáneamente", () => {
    const tree = {
      notas: "Árbol con múltiples problemas a la vez.",
      nodes: [
        // 1. componentId desconocido
        node({ nodeId: "bad-component", componentId: "hero-parallax-3000", orden: 1 }),
        // 2. variant inválida
        node({
          nodeId: "bad-variant",
          componentId: "hero-split",
          variant: "media-explosion",
          orden: 2,
          propsJson: JSON.stringify(HERO_SPLIT_PROPS),
        }),
        // 3. propsJson malformado
        node({ nodeId: "bad-json", componentId: "hero-split", orden: 3, propsJson: "{not json" }),
        // 4. props que violan schema
        node({
          nodeId: "bad-props",
          componentId: "feature-grid",
          variant: "3-col",
          orden: 4,
          propsJson: JSON.stringify({ titulo: "solo titulo" }),
        }),
        // 5. orden duplicado con el nodo anterior
        node({
          nodeId: "dup-orden",
          componentId: "footer-contact",
          variant: "default",
          orden: 4,
          propsJson: JSON.stringify(FOOTER_CONTACT_PROPS),
        }),
      ],
    };

    const result = validatePageTree(tree);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");

    // Al menos un error por cada nodo problemático + el error global de orden duplicado.
    expect(result.errors.some((e) => e.includes("bad-component"))).toBe(true);
    expect(result.errors.some((e) => e.includes("bad-variant"))).toBe(true);
    expect(result.errors.some((e) => e.includes("propsJson inválido en bad-json"))).toBe(true);
    expect(result.errors.some((e) => e.includes("bad-props"))).toBe(true);
    expect(result.errors.some((e) => e.includes("orden") && /duplicad/i.test(e))).toBe(true);
    expect(result.errors.length).toBeGreaterThanOrEqual(5);
  });
});

describe("validatePageTree — capability nodes (F6C-T2: componentId ∈ CAPABILITY_IDS)", () => {
  it("acepta un nodo capability válido (variant default, props válidas, sin choreography) y lo marca kind:'capability'", () => {
    const tree = validTree();
    tree.nodes.push(capabilityNode());
    const result = validatePageTree(tree);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok:true");
    const capNode = result.tree.nodes.find((n) => n.nodeId === "cap-1");
    expect(capNode?.kind).toBe("capability");
    expect(capNode?.componentId).toBe("coverage-map-v1");
    expect(capNode?.props).toEqual(COVERAGE_MAP_PROPS);
  });

  it("los nodos block del árbol siguen marcados kind:'block'", () => {
    const tree = validTree();
    tree.nodes.push(capabilityNode());
    const result = validatePageTree(tree);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok:true");
    const heroNode = result.tree.nodes.find((n) => n.nodeId === "hero-1");
    expect(heroNode?.kind).toBe("block");
  });

  it("rechaza variant !== 'default' en un nodo capability", () => {
    const tree = validTree();
    tree.nodes.push(capabilityNode({ variant: "media-right" }));
    const result = validatePageTree(tree);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");
    expect(
      result.errors.some(
        (e) => e.includes("cap-1") && e.includes("coverage-map-v1") && e.includes("media-right") && /variant/i.test(e)
      )
    ).toBe(true);
  });

  it("props inválidas contra el propsSchema de la capability acumulan error con path y nodeId", () => {
    const tree = validTree();
    // coverage-map-v1 exige zonas: array min 1 de { nombre, poligonoOrRadio } — omitimos zonas.
    tree.nodes.push(capabilityNode({ propsJson: JSON.stringify({}) }));
    const result = validatePageTree(tree);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");
    expect(result.errors.some((e) => e.includes("cap-1") && e.includes("zonas"))).toBe(true);
  });

  it("propsJson malformado en un nodo capability produce el error exacto 'propsJson inválido en <nodeId>'", () => {
    const tree = validTree();
    tree.nodes.push(capabilityNode({ propsJson: "{not valid json" }));
    const result = validatePageTree(tree);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");
    expect(result.errors.some((e) => e.includes("propsJson inválido en cap-1"))).toBe(true);
  });

  it("rechaza choreography sobre un nodo capability (allowsChoreography:false)", () => {
    const tree = validTree();
    tree.nodes.push(
      capabilityNode({
        choreography: validChoreography({
          sequences: [
            {
              behaviorId: "fade-rise",
              targetSlot: "titulo",
              trigger: "load",
              order: 0,
              durationToken: "normal",
              delayStrategy: "none",
              intensity: 1,
            },
          ],
        }),
      })
    );
    const result = validatePageTree(tree);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");
    expect(
      result.errors.some((e) => e.includes("cap-1") && e.includes("coverage-map-v1") && /choreography/i.test(e))
    ).toBe(true);
  });

  it("componentId que no es ni block ni capability produce el mensaje ampliado 'ni block ni capability'", () => {
    const tree = validTree();
    tree.nodes[0] = node({ nodeId: "hero-1", componentId: "hero-parallax-3000", orden: 1 });
    const result = validatePageTree(tree);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");
    expect(
      result.errors.some((e) => e.includes("hero-1") && e.includes("hero-parallax-3000") && e.includes("ni como block ni como capability"))
    ).toBe(true);
  });

  it("árbol mixto (blocks + capability) valida ambos tipos de nodo correctamente", () => {
    const tree = validTree();
    tree.nodes.push(capabilityNode());
    const result = validatePageTree(tree);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok:true");
    expect(result.tree.nodes).toHaveLength(4);
    const kinds = result.tree.nodes.map((n) => n.kind);
    expect(kinds).toEqual(["block", "block", "block", "capability"]);
  });

  it("los nodos capability NO cuentan para MAX_CINEMATIC_NODES — 3 blocks cinematográficos + 1 capability sigue ok:true", () => {
    const tree = {
      notas: "3 nodos cinematográficos (blocks) + 1 capability — la capability no debe sumar al límite.",
      nodes: [
        node({
          nodeId: "c1",
          componentId: "hero-split",
          variant: "media-right",
          orden: 1,
          propsJson: JSON.stringify(HERO_SPLIT_PROPS),
          choreography: validChoreography({
            sequences: [
              { behaviorId: "fade-rise", targetSlot: "titulo", trigger: "load", order: 0, durationToken: "normal", delayStrategy: "none", intensity: 3 },
            ],
          }),
        }),
        node({
          nodeId: "c2",
          componentId: "hero-split",
          variant: "media-right",
          orden: 2,
          propsJson: JSON.stringify(HERO_SPLIT_PROPS),
          choreography: validChoreography({
            sequences: [
              { behaviorId: "fade-rise", targetSlot: "titulo", trigger: "load", order: 0, durationToken: "normal", delayStrategy: "none", intensity: 3 },
            ],
          }),
        }),
        node({
          nodeId: "c3",
          componentId: "hero-split",
          variant: "media-right",
          orden: 3,
          propsJson: JSON.stringify(HERO_SPLIT_PROPS),
          choreography: validChoreography({
            sequences: [
              { behaviorId: "fade-rise", targetSlot: "titulo", trigger: "load", order: 0, durationToken: "normal", delayStrategy: "none", intensity: 3 },
            ],
          }),
        }),
        capabilityNode({ nodeId: "cap-1", orden: 4 }),
      ],
    };
    const result = validatePageTree(tree);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok:true");
    expect(result.tree.nodes).toHaveLength(4);
  });

  it("árbol sin ningún nodo capability sigue validando ok:true (compat retro)", () => {
    const result = validatePageTree(validTree());
    expect(result.ok).toBe(true);
  });
});
