import { describe, expect, it } from "vitest";
import { extractPageTreeCopy, MAX_TEXTS_PER_NODE, MAX_TEXT_LENGTH, type PageTreeForCopy } from "./extract-copy";

function tree(nodes: PageTreeForCopy["nodes"]): PageTreeForCopy {
  return { nodes };
}

describe("extractPageTreeCopy", () => {
  it("extrae strings anidados a cualquier profundidad (objeto anidado + array de strings)", () => {
    const [result] = extractPageTreeCopy(
      tree([
        {
          nodeId: "n1",
          componentId: "hero-split",
          variant: "media-right",
          orden: 1,
          props: {
            titulo: "Título real",
            cta: { label: "Empieza ahora", href: "/contacto" },
            badges: ["Badge uno", "Badge dos"],
          },
        },
      ])
    );

    expect(result!.texts).toEqual(["Título real", "Empieza ahora", "Badge uno", "Badge dos"]);
  });

  it("excluye cualquier valor que cuelgue de una key href", () => {
    const [result] = extractPageTreeCopy(
      tree([
        {
          nodeId: "n1",
          componentId: "hero-split",
          variant: "media-right",
          orden: 1,
          props: { cta: { label: "Ir", href: "https://evil.com/inyeccion" } },
        },
      ])
    );

    expect(result!.texts).not.toContain("https://evil.com/inyeccion");
    expect(result!.texts).toEqual(["Ir"]);
  });

  it("recorre arrays de objetos anidados (p.ej. features[].descripcion)", () => {
    const [result] = extractPageTreeCopy(
      tree([
        {
          nodeId: "n1",
          componentId: "feature-grid",
          variant: "default",
          orden: 1,
          props: {
            features: [
              { titulo: "Uno", descripcion: "Desc uno" },
              { titulo: "Dos", descripcion: "Desc dos" },
            ],
          },
        },
      ])
    );

    expect(result!.texts).toEqual(["Uno", "Desc uno", "Dos", "Desc dos"]);
  });

  it("ignora strings vacíos o solo espacios", () => {
    const [result] = extractPageTreeCopy(
      tree([{ nodeId: "n1", componentId: "x", variant: "default", orden: 1, props: { titulo: "   ", subtitulo: "Real" } }])
    );

    expect(result!.texts).toEqual(["Real"]);
  });

  it("trunca strings más largos que MAX_TEXT_LENGTH con '…' al final", () => {
    const long = "a".repeat(MAX_TEXT_LENGTH + 50);
    const [result] = extractPageTreeCopy(
      tree([{ nodeId: "n1", componentId: "x", variant: "default", orden: 1, props: { titulo: long } }])
    );

    expect(result!.texts[0]).toHaveLength(MAX_TEXT_LENGTH + 1); // +1 por el "…"
    expect(result!.texts[0]!.endsWith("…")).toBe(true);
  });

  it("limita a MAX_TEXTS_PER_NODE strings por nodo, sin importar cuántos campos tenga props", () => {
    const props: Record<string, string> = {};
    for (let i = 0; i < MAX_TEXTS_PER_NODE + 10; i++) props[`campo${i}`] = `texto ${i}`;
    const [result] = extractPageTreeCopy(tree([{ nodeId: "n1", componentId: "x", variant: "default", orden: 1, props }]));

    expect(result!.texts).toHaveLength(MAX_TEXTS_PER_NODE);
  });

  it("preserva la metadata del nodo (nodeId/componentId/variant/orden) junto al copy", () => {
    const [result] = extractPageTreeCopy(
      tree([{ nodeId: "n7", componentId: "footer-contact", variant: "default", orden: 5, props: { titulo: "Contacto" } }])
    );

    expect(result).toMatchObject({ nodeId: "n7", componentId: "footer-contact", variant: "default", orden: 5 });
  });

  it("procesa varios nodos de forma independiente, en el mismo orden del árbol", () => {
    const result = extractPageTreeCopy(
      tree([
        { nodeId: "n1", componentId: "hero-split", variant: "media-right", orden: 1, props: { titulo: "Uno" } },
        { nodeId: "n2", componentId: "footer-contact", variant: "default", orden: 2, props: { titulo: "Dos" } },
      ])
    );

    expect(result).toHaveLength(2);
    expect(result[0]!.texts).toEqual(["Uno"]);
    expect(result[1]!.texts).toEqual(["Dos"]);
  });

  it("un nodo sin ningún string en props devuelve texts vacío, no lanza", () => {
    const [result] = extractPageTreeCopy(
      tree([{ nodeId: "n1", componentId: "x", variant: "default", orden: 1, props: { numero: 42, activo: true, nulo: null } }])
    );

    expect(result!.texts).toEqual([]);
  });
});
