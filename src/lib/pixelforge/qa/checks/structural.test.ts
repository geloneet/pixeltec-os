import { describe, expect, it } from "vitest";
import { validatePageTree, type ValidatedPageTree, type ValidatedPageNode } from "@/lib/pixelforge/registry/validate-page-tree";
import { composePageTreeDomainSchema } from "@/lib/pixelforge/schemas/compose-page-tree";
import { checkST001, checkST002, checkST003, buildStaleVersionFinding } from "./structural";

function validatedNode(overrides: Partial<ValidatedPageNode> = {}): ValidatedPageNode {
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

describe("checkST001", () => {
  it("emite un finding POR error, cada uno con locationKey distinta (evita colapsar el dedupe)", () => {
    const findings = checkST001(["error uno", "error dos", "error tres"]);
    expect(findings).toHaveLength(3);
    expect(findings.map((f) => f.description)).toEqual(["error uno", "error dos", "error tres"]);
    for (const f of findings) {
      expect(f.checkCode).toBe("QA-ST-001");
      expect(f.severity).toBe("critical");
      expect(f.blocking).toBe(true);
      expect(f.source).toBe("det");
    }
    const keys = new Set(findings.map((f) => f.locationKey));
    expect(keys.size).toBe(3);
  });

  it("array vacío produce sin findings", () => {
    expect(checkST001([])).toEqual([]);
  });

  it("es determinista: misma entrada produce la misma salida", () => {
    const errors = ["a", "b"];
    expect(checkST001(errors)).toEqual(checkST001([...errors]));
  });
});

describe("checkST002 — 3-14 nodos, un footer-contact al final", () => {
  it("árbol válido (3 nodos, footer al final) no produce findings", () => {
    const t = tree([
      validatedNode({ nodeId: "n1", componentId: "feature-grid", orden: 1 }),
      validatedNode({ nodeId: "n2", componentId: "cta-banner", orden: 2 }),
      validatedNode({ nodeId: "n3", componentId: "footer-contact", orden: 3 }),
    ]);
    expect(checkST002(t)).toEqual([]);
  });

  it("menos de 3 nodos → finding node-count", () => {
    const t = tree([
      validatedNode({ nodeId: "n1", componentId: "feature-grid", orden: 1 }),
      validatedNode({ nodeId: "n2", componentId: "footer-contact", orden: 2 }),
    ]);
    const findings = checkST002(t);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.description).toContain("2 nodos");
  });

  it("más de 14 nodos → finding node-count", () => {
    const nodes: ValidatedPageNode[] = [];
    for (let i = 1; i <= 14; i += 1) {
      nodes.push(validatedNode({ nodeId: `n${i}`, componentId: "feature-grid", orden: i }));
    }
    nodes.push(validatedNode({ nodeId: "n15", componentId: "footer-contact", orden: 15 }));
    const findings = checkST002(tree(nodes));
    expect(findings.some((f) => f.description.includes("15 nodos"))).toBe(true);
  });

  it("sin footer-contact → finding footer-count", () => {
    const t = tree([
      validatedNode({ nodeId: "n1", componentId: "feature-grid", orden: 1 }),
      validatedNode({ nodeId: "n2", componentId: "cta-banner", orden: 2 }),
      validatedNode({ nodeId: "n3", componentId: "proof-logos", orden: 3 }),
    ]);
    const findings = checkST002(t);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.description).toContain("footer-contact");
  });

  it("dos footer-contact → finding footer-count", () => {
    const t = tree([
      validatedNode({ nodeId: "n1", componentId: "footer-contact", orden: 1 }),
      validatedNode({ nodeId: "n2", componentId: "cta-banner", orden: 2 }),
      validatedNode({ nodeId: "n3", componentId: "footer-contact", orden: 3 }),
    ]);
    const findings = checkST002(t);
    expect(findings.some((f) => f.description.includes("Solo puede haber un"))).toBe(true);
  });

  it("footer-contact presente pero NO al final → finding footer-position", () => {
    const t = tree([
      validatedNode({ nodeId: "n1", componentId: "footer-contact", orden: 1 }),
      validatedNode({ nodeId: "n2", componentId: "cta-banner", orden: 2 }),
      validatedNode({ nodeId: "n3", componentId: "feature-grid", orden: 3 }),
    ]);
    const findings = checkST002(t);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.description).toContain("último nodo");
  });

  it("equivalencia con checkComposerRules real (schemas/compose-page-tree.ts): footer no al final falla en ambos", () => {
    const rawTree = {
      notas: "equivalencia",
      nodes: [
        {
          nodeId: "n1",
          componentId: "footer-contact",
          variant: "default",
          orden: 1,
          propsJson: JSON.stringify({ empresa: "PIXELTEC.MX", links: [] }),
        },
        {
          nodeId: "n2",
          componentId: "cta-banner",
          variant: "solid",
          orden: 2,
          propsJson: JSON.stringify({ titulo: "CTA", cta: { label: "Ir", href: "/contacto" } }),
        },
        {
          nodeId: "n3",
          componentId: "feature-grid",
          variant: "3-col",
          orden: 3,
          propsJson: JSON.stringify({
            titulo: "Features",
            features: [
              { titulo: "a", texto: "a" },
              { titulo: "b", texto: "b" },
              { titulo: "c", texto: "c" },
            ],
          }),
        },
      ],
    };

    // El schema real de dominio del composer (zod v4) rechaza este árbol.
    const domainResult = composePageTreeDomainSchema.safeParse(rawTree);
    expect(domainResult.success).toBe(false);

    // validatePageTree (estructural, sin la regla de composer) SÍ lo acepta.
    const validated = validatePageTree(rawTree);
    expect(validated.ok).toBe(true);
    if (!validated.ok) throw new Error("unreachable");

    // Nuestra reimplementación pura detecta la MISMA violación.
    const findings = checkST002(validated.tree);
    expect(findings.some((f) => f.description.includes("último nodo"))).toBe(true);
  });
});

describe("checkST003 — orden 1..n consecutivo", () => {
  it("orden consecutivo sin huecos no produce findings", () => {
    const t = tree([
      validatedNode({ nodeId: "n1", orden: 1 }),
      validatedNode({ nodeId: "n2", orden: 2 }),
      validatedNode({ nodeId: "n3", orden: 3 }),
    ]);
    expect(checkST003(t)).toEqual([]);
  });

  it("un hueco en orden produce un finding minor listando el/los valores faltantes", () => {
    const t = tree([
      validatedNode({ nodeId: "n1", orden: 1 }),
      validatedNode({ nodeId: "n2", orden: 2 }),
      validatedNode({ nodeId: "n3", orden: 4 }),
    ]);
    const findings = checkST003(t);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe("minor");
    expect(findings[0]!.blocking).toBe(false);
    expect(findings[0]!.description).toContain("3");
  });

  it("orden empezando en 2 (falta el 1) produce finding", () => {
    const t = tree([validatedNode({ nodeId: "n1", orden: 2 }), validatedNode({ nodeId: "n2", orden: 3 })]);
    const findings = checkST003(t);
    expect(findings[0]!.description).toContain("1");
  });
});

describe("buildStaleVersionFinding", () => {
  it("null cuando la versión evaluada es la más reciente", () => {
    expect(buildStaleVersionFinding(3, 3)).toBeNull();
  });

  it("finding info no-bloqueante cuando la versión evaluada quedó atrás", () => {
    const finding = buildStaleVersionFinding(2, 5);
    expect(finding).not.toBeNull();
    expect(finding!.checkCode).toBe("QA-ST-004");
    expect(finding!.severity).toBe("info");
    expect(finding!.blocking).toBe(false);
    expect(finding!.description).toContain("2");
    expect(finding!.description).toContain("5");
  });
});
