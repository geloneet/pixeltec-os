import { describe, expect, it } from "vitest";
import { composePageTreeDomainSchema } from "./compose-page-tree";

/** Mismas fixtures mínimas válidas que `registry/validate-page-tree.test.ts` (blocks reales del registry). */
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

const FOOTER_CONTACT_PROPS = {
  empresa: "PIXELTEC.MX",
  telefono: "+52 55 0000 0000",
  links: [{ label: "Aviso de privacidad", href: "/privacidad" }],
};

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

describe("composePageTreeDomainSchema — árbol válido (D2)", () => {
  it("acepta un árbol que también pasa validatePageTree", () => {
    const result = composePageTreeDomainSchema.safeParse(validTree());
    expect(result.success).toBe(true);
  });
});

describe("composePageTreeDomainSchema — árbol inválido (D2: vuelca los errores de validatePageTree como issues)", () => {
  it("componentId desconocido produce un issue con el mensaje exacto de validatePageTree", () => {
    const tree = validTree();
    tree.nodes[0] = node({ nodeId: "hero-1", componentId: "hero-parallax-3000", orden: 1 });
    const result = composePageTreeDomainSchema.safeParse(tree);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected success:false");
    expect(
      result.error.issues.some(
        (issue) => issue.message.includes("hero-1") && issue.message.includes("hero-parallax-3000")
      )
    ).toBe(true);
  });

  it("propsJson malformado produce un issue con el mensaje exacto 'propsJson inválido en <nodeId>'", () => {
    const tree = validTree();
    tree.nodes[0] = node({ nodeId: "hero-1", componentId: "hero-split", orden: 1, propsJson: "{not valid json" });
    const result = composePageTreeDomainSchema.safeParse(tree);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected success:false");
    expect(result.error.issues.some((issue) => issue.message.includes("propsJson inválido en hero-1"))).toBe(true);
  });

  it("props que violan el propsSchema del block producen un issue nombrando el nodeId", () => {
    const tree = validTree();
    tree.nodes[0] = node({
      nodeId: "hero-1",
      componentId: "hero-split",
      orden: 1,
      propsJson: JSON.stringify({ titulo: "Solo título, falta todo lo demás" }),
    });
    const result = composePageTreeDomainSchema.safeParse(tree);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected success:false");
    expect(result.error.issues.some((issue) => issue.message.includes("hero-1"))).toBe(true);
  });

  it("4 nodos cinematográficos (por encima del máximo de 3) producen un issue con el mensaje de validatePageTree", () => {
    function cinematicNode(nodeId: string, orden: number) {
      return node({
        nodeId,
        componentId: "hero-split",
        variant: "media-right",
        orden,
        propsJson: JSON.stringify(HERO_SPLIT_PROPS),
        choreography: {
          narrativePurpose: "Anclar la promesa de urgencia desde el primer scroll.",
          motifConnection: "El motif es 'respuesta inmediata'.",
          reducedMotionFallback: "Mostrar todo estático, sin animación.",
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
        },
      });
    }

    const tree = {
      notas: "4 nodos cinematográficos, excede el límite.",
      nodes: [cinematicNode("c1", 1), cinematicNode("c2", 2), cinematicNode("c3", 3), cinematicNode("c4", 4)],
    };
    const result = composePageTreeDomainSchema.safeParse(tree);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected success:false");
    expect(result.error.issues.some((issue) => /cinemat/i.test(issue.message))).toBe(true);
  });

  it("un árbol con menos de 3 nodos falla en la forma base (pageTreeSchema) antes de llegar a validatePageTree", () => {
    const tree = validTree();
    tree.nodes = tree.nodes.slice(0, 2);
    const result = composePageTreeDomainSchema.safeParse(tree);
    expect(result.success).toBe(false);
  });
});
