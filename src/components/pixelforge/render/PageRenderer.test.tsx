// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PageRenderer } from "./PageRenderer";
import { SectionErrorBoundary } from "./SectionErrorBoundary";
import { directionTokensToCssVars, type DesignTokens } from "./tokens";
import type { ValidatedPageTree } from "@/lib/pixelforge/registry/validate-page-tree";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const TOKENS: DesignTokens = {
  paleta: [
    { token: "color-primario", valor: "#0F172A", uso: "Marca principal." },
    { token: "color-fondo", valor: "#FFFFFF", uso: "Fondo general." },
    { token: "color-acento", valor: "#F59E0B", uso: "CTAs." },
  ],
  tipografia: { display: "Fraunces", body: "Inter", escala: "Modular 1.25" },
  radios: "suaves",
  espaciado: "equilibrado",
};

function tree(nodes: ValidatedPageTree["nodes"]): ValidatedPageTree {
  return { nodes, notas: "fixture" };
}

describe("PageRenderer", () => {
  it("aplica las vars --pf-* de la dirección en el wrapper raíz", () => {
    const { container } = render(
      <PageRenderer
        tokens={TOKENS}
        tree={tree([
          {
            nodeId: "n1",
            componentId: "cta-banner",
            variant: "solid",
            orden: 1,
            props: { titulo: "Cierre", cta: { label: "Ir", href: "/" } },
          },
        ])}
      />
    );
    const page = container.querySelector(".pf-page")!;
    const style = page.getAttribute("style") ?? "";
    expect(style).toContain("--pf-primary: #0F172A");
    expect(style).toContain("--pf-bg: #FFFFFF");
    expect(style).toContain("--pf-font-display");
    // Coincide con el mapeo puro de tokens.
    expect(directionTokensToCssVars(TOKENS)["--pf-primary"]).toBe("#0F172A");
  });

  it("renderiza los nodos en el orden de `orden`, no en el del array", () => {
    const { container } = render(
      <PageRenderer
        tokens={TOKENS}
        tree={tree([
          {
            nodeId: "footer",
            componentId: "footer-contact",
            variant: "default",
            orden: 2,
            props: { empresa: "PIXELTEC.MX", links: [] },
          },
          {
            nodeId: "hero",
            componentId: "hero-split",
            variant: "media-right",
            orden: 1,
            props: {
              titulo: "Título hero",
              subtitulo: "Sub",
              cta: { label: "CTA", href: "/" },
              mediaAlt: "media",
              badges: [],
            },
          },
        ])}
      />
    );
    const blocks = Array.from(container.querySelectorAll(".pf-block"));
    expect(blocks[0].className).toContain("pf-hero-split");
    expect(blocks[1].className).toContain("pf-footer-contact");
  });

  it("pasa props + variant a cada block", () => {
    render(
      <PageRenderer
        tokens={TOKENS}
        tree={tree([
          {
            nodeId: "n1",
            componentId: "cta-banner",
            variant: "gradient",
            orden: 1,
            props: { titulo: "Con gradiente", cta: { label: "Ir", href: "/" } },
          },
        ])}
      />
    );
    const section = document.querySelector(".pf-cta-banner")!;
    expect(section.getAttribute("style")).toContain("linear-gradient");
    expect(screen.getByText("Con gradiente")).toBeInTheDocument();
  });

  it("con la paridad total (T6) un BlockId del registry se resuelve a su block real, no al placeholder", () => {
    render(
      <PageRenderer
        tokens={TOKENS}
        tree={tree([
          {
            nodeId: "n1",
            componentId: "stats-band",
            variant: "default",
            orden: 1,
            props: { stats: [{ valor: "+250", etiqueta: "Proyectos" }, { valor: "98%", etiqueta: "Satisfacción" }] },
          },
        ])}
      />
    );
    expect(screen.getByText("+250")).toBeInTheDocument();
    expect(screen.queryByText(/aún no disponible/)).not.toBeInTheDocument();
  });

  it("degrada a placeholder neutro un componentId sin componente en RENDER_MAP (rama defensiva)", () => {
    render(
      <PageRenderer
        tokens={TOKENS}
        tree={tree([
          {
            nodeId: "n1",
            // Id fuera del registry: no puede llegar por un árbol validado, pero PageRenderer lo degrada con gracia.
            componentId: "bloque-inexistente" as ValidatedPageTree["nodes"][number]["componentId"],
            variant: "default",
            orden: 1,
            props: {},
          },
        ])}
      />
    );
    expect(screen.getByText(/aún no disponible/)).toBeInTheDocument();
  });

  it("una sección que lanza no tumba la landing (boundary por sección)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // props inválidas para hero-split (faltan campos) → el block lanza al leer cta.href.
    render(
      <PageRenderer
        tokens={TOKENS}
        tree={tree([
          { nodeId: "boom", componentId: "hero-split", variant: "media-right", orden: 1, props: {} },
          {
            nodeId: "ok",
            componentId: "cta-banner",
            variant: "solid",
            orden: 2,
            props: { titulo: "Sigo vivo", cta: { label: "Ir", href: "/" } },
          },
        ])}
      />
    );
    expect(screen.getByText(/no se pudo renderizar \(hero-split\)/)).toBeInTheDocument();
    expect(screen.getByText("Sigo vivo")).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("SectionErrorBoundary", () => {
  function Boom(): never {
    throw new Error("kaboom");
  }

  it("captura el error, muestra la tarjeta neutra y llama console.error", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <SectionErrorBoundary componentId="feature-grid">
        <Boom />
      </SectionErrorBoundary>
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Esta sección no se pudo renderizar (feature-grid).");
    expect(errorSpy).toHaveBeenCalled();
  });

  it("renderiza los children cuando no hay error", () => {
    render(
      <SectionErrorBoundary componentId="cta-banner">
        <p>contenido sano</p>
      </SectionErrorBoundary>
    );
    expect(screen.getByText("contenido sano")).toBeInTheDocument();
  });
});
