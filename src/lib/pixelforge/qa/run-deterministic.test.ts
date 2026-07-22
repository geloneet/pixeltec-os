import { describe, expect, it } from "vitest";
import { runDeterministicChecks, type DeterministicChecksInput } from "./run-deterministic";

const VALID_TREE = {
  notas: "fixture válida",
  nodes: [
    {
      nodeId: "n1",
      componentId: "hero-split",
      variant: "media-right",
      orden: 1,
      propsJson: JSON.stringify({
        titulo: "Título corto",
        subtitulo: "Subtítulo corto",
        cta: { label: "Ir", href: "/contacto" },
        mediaAlt: "Alt de media",
        badges: ["a"],
      }),
    },
    {
      nodeId: "n2",
      componentId: "feature-grid",
      variant: "3-col",
      orden: 2,
      propsJson: JSON.stringify({
        titulo: "Features",
        features: [
          { titulo: "a", texto: "a" },
          { titulo: "b", texto: "b" },
          { titulo: "c", texto: "c" },
        ],
      }),
    },
    {
      nodeId: "n3",
      componentId: "footer-contact",
      variant: "default",
      orden: 3,
      propsJson: JSON.stringify({ empresa: "PIXELTEC.MX", links: [] }),
    },
  ],
};

const CLEAN_DESIGN_TOKENS = {
  paleta: [
    { token: "color-fondo", valor: "#ffffff", uso: "Fondo general de la landing." },
    { token: "color-texto", valor: "#0f172a", uso: "Texto principal del cuerpo." },
    { token: "color-primario", valor: "#1e3a8a", uso: "Color de marca para CTAs." },
    { token: "color-acento", valor: "#334155", uso: "Acento secundario." },
    { token: "color-muted", valor: "#475569", uso: "Texto secundario, bordes." },
  ],
  tipografia: { display: "Fraunces", body: "Inter", escala: "modular 1.25, base 16px" },
  radios: "suaves",
  espaciado: "equilibrado",
};

const CHOSEN_DIRECTION: DeterministicChecksInput["chosenDirection"] = {
  designTokens: CLEAN_DESIGN_TOKENS,
  status: "chosen",
};

describe("runDeterministicChecks — árbol válido + dirección chosen limpia", () => {
  it("no produce findings ni checksSkipped", () => {
    const result = runDeterministicChecks({ tree: VALID_TREE, chosenDirection: CHOSEN_DIRECTION });
    expect(result.findings).toEqual([]);
    expect(result.checksSkipped).toEqual([]);
  });

  // PF-F8 T4 — extensión aditiva: `treeUsesCapabilities`.
  it("treeUsesCapabilities es false si el árbol no usa ninguna capability", () => {
    const result = runDeterministicChecks({ tree: VALID_TREE, chosenDirection: CHOSEN_DIRECTION });
    expect(result.treeUsesCapabilities).toBe(false);
  });

  it("treeUsesCapabilities es true si el árbol tiene al menos un nodo capability", () => {
    const treeWithCapability = {
      notas: "fixture con capability",
      nodes: [
        ...VALID_TREE.nodes.slice(0, 2),
        {
          nodeId: "cap-1",
          componentId: "coverage-map-v1",
          variant: "default",
          orden: 3,
          propsJson: JSON.stringify({ zonas: [{ nombre: "Puerto Vallarta", poligonoOrRadio: "10km desde el centro" }] }),
        },
        { ...VALID_TREE.nodes[2], orden: 4 },
      ],
    };
    const result = runDeterministicChecks({ tree: treeWithCapability, chosenDirection: CHOSEN_DIRECTION });
    expect(result.treeUsesCapabilities).toBe(true);
  });

  it("treeUsesCapabilities es false si el árbol no validó (no hay forma de saberlo)", () => {
    const result = runDeterministicChecks({ tree: { nodes: [], notas: "" }, chosenDirection: CHOSEN_DIRECTION });
    expect(result.treeUsesCapabilities).toBe(false);
  });
});

describe("runDeterministicChecks — árbol inválido", () => {
  it("emite ST-001 por cada error y salta los checks que requieren árbol validado", () => {
    const result = runDeterministicChecks({ tree: { nodes: [], notas: "" }, chosenDirection: CHOSEN_DIRECTION });
    expect(result.findings.some((f) => f.checkCode === "QA-ST-001")).toBe(true);
    expect(result.findings.every((f) => f.checkCode === "QA-ST-001" || f.checkCode.startsWith("QA-DI-"))).toBe(true);
    for (const code of ["QA-ST-002", "QA-ST-003", "QA-VI-008", "QA-VI-009", "QA-MO-004", "QA-MO-006", "QA-CA-001", "QA-CA-005", "QA-TE-009"]) {
      expect(result.checksSkipped).toContain(code);
    }
  });

  it("un tree que no es ni siquiera un objeto (p.ej. null) no lanza — produce ST-001 y skips", () => {
    expect(() => runDeterministicChecks({ tree: null, chosenDirection: CHOSEN_DIRECTION })).not.toThrow();
    const result = runDeterministicChecks({ tree: null, chosenDirection: CHOSEN_DIRECTION });
    expect(result.findings.some((f) => f.checkCode === "QA-ST-001")).toBe(true);
  });
});

describe("runDeterministicChecks — sin dirección chosen", () => {
  it("emite DI-006 y salta los checks de diseño que dependen de designTokens", () => {
    const result = runDeterministicChecks({ tree: VALID_TREE, chosenDirection: null });
    expect(result.findings.some((f) => f.checkCode === "QA-DI-006")).toBe(true);
    for (const code of ["QA-DI-001", "QA-DI-002", "QA-DI-003", "QA-DI-004", "QA-DI-005"]) {
      expect(result.checksSkipped).toContain(code);
    }
    // Los checks dependientes del árbol SÍ corrieron (el árbol es válido).
    expect(result.checksSkipped).not.toContain("QA-ST-002");
  });
});

describe("runDeterministicChecks — designTokens malformados (nunca lanza)", () => {
  it("designTokens con forma inesperada salta los checks de diseño en vez de lanzar", () => {
    const malformed = { designTokens: { esto: "no es un DesignTokens válido" }, status: "chosen" };
    expect(() => runDeterministicChecks({ tree: VALID_TREE, chosenDirection: malformed })).not.toThrow();
    const result = runDeterministicChecks({ tree: VALID_TREE, chosenDirection: malformed });
    for (const code of ["QA-DI-001", "QA-DI-002", "QA-DI-003", "QA-DI-004", "QA-DI-005"]) {
      expect(result.checksSkipped).toContain(code);
    }
  });
});

describe("runDeterministicChecks — árbol inválido Y sin dirección chosen a la vez", () => {
  it("combina ambos skips y ambos findings (ST-001 + DI-006)", () => {
    const result = runDeterministicChecks({ tree: { nodes: [], notas: "" }, chosenDirection: null });
    expect(result.findings.some((f) => f.checkCode === "QA-ST-001")).toBe(true);
    expect(result.findings.some((f) => f.checkCode === "QA-DI-006")).toBe(true);
    expect(result.checksSkipped.length).toBe(9 + 5);
  });
});

describe("runDeterministicChecks — determinismo", () => {
  it("la misma entrada produce siempre la misma salida", () => {
    const input: DeterministicChecksInput = { tree: VALID_TREE, chosenDirection: CHOSEN_DIRECTION };
    const first = runDeterministicChecks(structuredClone(input) as DeterministicChecksInput);
    const second = runDeterministicChecks(structuredClone(input) as DeterministicChecksInput);
    expect(second).toEqual(first);
  });
});
