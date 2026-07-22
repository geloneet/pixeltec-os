// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";

// MotionSection se mockea: PageRenderer solo debe ENVOLVER los nodos con
// choreography y pasarles `motionDna` — no queremos arrastrar framer-motion ni
// re-testear el motion aquí (eso vive en MotionSection.test.tsx). El mock
// registra sus props y renderiza children para poder aseverar sobre ambos.
const motionCalls = vi.hoisted(() => [] as { nodeId: string; choreography: unknown; motionDna: unknown }[]);
vi.mock("./motion/MotionSection", () => ({
  MotionSection: ({
    nodeId,
    choreography,
    motionDna,
    children,
  }: {
    nodeId: string;
    choreography: unknown;
    motionDna: unknown;
    children: React.ReactNode;
  }) => {
    motionCalls.push({ nodeId, choreography, motionDna });
    return <div data-testid={`motion-${nodeId}`}>{children}</div>;
  },
}));

import type React from "react";
import { PageRenderer } from "./PageRenderer";
import { SectionErrorBoundary } from "./SectionErrorBoundary";
import { directionTokensToCssVars, type DesignTokens } from "./tokens";
import type { ValidatedPageTree } from "@/lib/pixelforge/registry/validate-page-tree";
import { CAPABILITY_RENDER_MAP } from "./capabilities";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  motionCalls.length = 0;
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

describe("PageRenderer — superficie DOM de QA (PF-F8 T3)", () => {
  it("cada nodo lleva data-pf-node/data-pf-component (block y capability), sin tocar clases/orden existentes", () => {
    const { container } = render(
      <PageRenderer
        tokens={TOKENS}
        tree={tree([
          {
            nodeId: "hero-1",
            componentId: "hero-split",
            kind: "block",
            variant: "media-right",
            orden: 1,
            props: {
              titulo: "Título",
              subtitulo: "Sub",
              cta: { label: "CTA", href: "/" },
              mediaAlt: "media",
              badges: [],
            },
          },
          {
            nodeId: "proceso-1",
            componentId: "process-visualizer-v1",
            kind: "capability",
            variant: "default",
            orden: 2,
            props: {
              pasos: [{ titulo: "A", descripcion: "a" }, { titulo: "B", descripcion: "b" }],
            },
          },
        ])}
      />
    );
    const heroWrapper = container.querySelector('[data-pf-node="hero-1"]');
    expect(heroWrapper).not.toBeNull();
    expect(heroWrapper).toHaveAttribute("data-pf-component", "hero-split");
    // El wrapper es ADITIVO: la clase del block real sigue existiendo, sin
    // importar cuántos niveles de anidamiento tenga el atributo.
    expect(heroWrapper?.querySelector(".pf-hero-split")).not.toBeNull();

    const capWrapper = container.querySelector('[data-pf-node="proceso-1"]');
    expect(capWrapper).not.toBeNull();
    expect(capWrapper).toHaveAttribute("data-pf-component", "process-visualizer-v1");
    expect(capWrapper?.querySelector('[role="tablist"]')).not.toBeNull();
  });

  it("el placeholder de un componentId sin componente también lleva data-pf-node/data-pf-component", () => {
    const { container } = render(
      <PageRenderer
        tokens={TOKENS}
        tree={tree([
          {
            nodeId: "fantasma-1",
            componentId: "bloque-inexistente" as ValidatedPageTree["nodes"][number]["componentId"],
            kind: "block",
            variant: "default",
            orden: 1,
            props: {},
          },
        ])}
      />
    );
    const wrapper = container.querySelector('[data-pf-node="fantasma-1"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper).toHaveAttribute("data-pf-component", "bloque-inexistente");
    expect(screen.getByText(/aún no disponible/)).toBeInTheDocument();
  });
});

describe("PageRenderer", () => {
  it("aplica las vars --pf-* de la dirección en el wrapper raíz", () => {
    const { container } = render(
      <PageRenderer
        tokens={TOKENS}
        tree={tree([
          {
            nodeId: "n1",
            componentId: "cta-banner",
            kind: "block",
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
            kind: "block",
            variant: "default",
            orden: 2,
            props: { empresa: "PIXELTEC.MX", links: [] },
          },
          {
            nodeId: "hero",
            componentId: "hero-split",
            kind: "block",
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
            kind: "block",
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
            kind: "block",
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
            kind: "block",
            variant: "default",
            orden: 1,
            props: {},
          },
        ])}
      />
    );
    expect(screen.getByText(/aún no disponible/)).toBeInTheDocument();
  });

  it("envuelve en MotionSection SOLO los nodos con choreography y le pasa motionDna", () => {
    const choreography = {
      narrativePurpose: "Entrada.",
      motifConnection: "Motif.",
      reducedMotionFallback: "Sin movimiento.",
      sequences: [
        {
          behaviorId: "fade-rise",
          targetSlot: "titulo",
          trigger: "load" as const,
          order: 0,
          durationToken: "normal" as const,
          delayStrategy: "none" as const,
          intensity: 2,
        },
      ],
    };
    const motionDna = { ritmo: "rapido" as const, intensidadGlobal: 3 as const };
    render(
      <PageRenderer
        tokens={TOKENS}
        motionDna={motionDna}
        tree={tree([
          {
            nodeId: "conMotion",
            componentId: "stats-band",
            kind: "block",
            variant: "default",
            orden: 1,
            props: { stats: [{ valor: "+250", etiqueta: "Proyectos" }] },
            choreography,
          },
          {
            nodeId: "sinMotion",
            componentId: "cta-banner",
            kind: "block",
            variant: "solid",
            orden: 2,
            props: { titulo: "Cierre", cta: { label: "Ir", href: "/" } },
          },
        ])}
      />
    );
    // Solo el nodo con choreography pasó por MotionSection.
    expect(motionCalls).toHaveLength(1);
    expect(motionCalls[0].nodeId).toBe("conMotion");
    expect(motionCalls[0].choreography).toEqual(choreography);
    expect(motionCalls[0].motionDna).toEqual(motionDna);
    // El nodo sin choreography NO se envolvió.
    expect(screen.queryByTestId("motion-sinMotion")).toBeNull();
    // Ambos blocks se renderizan igualmente.
    expect(screen.getByText("+250")).toBeInTheDocument();
    expect(screen.getByText("Cierre")).toBeInTheDocument();
  });

  it("una sección que lanza no tumba la landing (boundary por sección)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // props inválidas para hero-split (faltan campos) → el block lanza al leer cta.href.
    render(
      <PageRenderer
        tokens={TOKENS}
        tree={tree([
          { nodeId: "boom", componentId: "hero-split", kind: "block", variant: "media-right", orden: 1, props: {} },
          {
            nodeId: "ok",
            componentId: "cta-banner",
            kind: "block",
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

describe("PageRenderer — capability nodes (F6C-T5)", () => {
  it("resuelve un nodo kind:capability a su componente real, dentro del boundary", () => {
    render(
      <PageRenderer
        tokens={TOKENS}
        tree={tree([
          {
            nodeId: "proceso",
            componentId: "process-visualizer-v1",
            kind: "capability",
            variant: "default",
            orden: 1,
            props: {
              pasos: [
                { titulo: "Contacto", descripcion: "Nos escribes por WhatsApp." },
                { titulo: "Instalación", descripcion: "Ejecutamos en sitio." },
              ],
            },
          },
        ])}
      />
    );
    // El componente real de la capability se montó (tablist del stepper).
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.queryByText(/aún no disponible/)).not.toBeInTheDocument();
    // NUNCA se envolvió en MotionSection.
    expect(motionCalls).toHaveLength(0);
    expect(screen.queryByTestId("motion-proceso")).toBeNull();
  });

  it("un nodo capability con choreography (hand-built, inválido per validatePageTree) NUNCA se envuelve en MotionSection — kind manda", () => {
    const choreography = {
      narrativePurpose: "Entrada.",
      motifConnection: "Motif.",
      reducedMotionFallback: "Sin movimiento.",
      sequences: [
        {
          behaviorId: "fade-rise",
          targetSlot: "titulo",
          trigger: "load" as const,
          order: 0,
          durationToken: "normal" as const,
          delayStrategy: "none" as const,
          intensity: 2,
        },
      ],
    };
    render(
      <PageRenderer
        tokens={TOKENS}
        tree={tree([
          {
            nodeId: "capConMotion",
            componentId: "process-visualizer-v1",
            kind: "capability",
            variant: "default",
            orden: 1,
            props: { pasos: [{ titulo: "A", descripcion: "a" }, { titulo: "B", descripcion: "b" }] },
            choreography,
          },
        ])}
      />
    );
    // Aunque el nodo trae `choreography`, `kind: "capability"` gana: nunca pasa por MotionSection.
    expect(motionCalls).toHaveLength(0);
    expect(screen.queryByTestId("motion-capConMotion")).toBeNull();
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  it("degrada a placeholder neutro un componentId capability sin componente en CAPABILITY_RENDER_MAP (rama defensiva)", () => {
    render(
      <PageRenderer
        tokens={TOKENS}
        tree={tree([
          {
            nodeId: "n1",
            componentId: "capability-inexistente" as ValidatedPageTree["nodes"][number]["componentId"],
            kind: "capability",
            variant: "default",
            orden: 1,
            props: {},
          },
        ])}
      />
    );
    expect(screen.getByText(/aún no disponible/)).toBeInTheDocument();
  });

  it("una capability que lanza cae al boundary y el resto del árbol sigue vivo", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const original = CAPABILITY_RENDER_MAP["comparison-table-v1"];
    // Monkey-patch de una sola entrada del mapa real para simular un componente
    // que lanza — las 4 implementaciones reales son deliberadamente defensivas
    // (D2: nunca lanzan ante props degeneradas), así que no hay props "reales"
    // que las hagan fallar; esto verifica la red de seguridad del boundary.
    (CAPABILITY_RENDER_MAP as Record<string, unknown>)["comparison-table-v1"] = function Boom(): never {
      throw new Error("kaboom capability");
    };
    try {
      render(
        <PageRenderer
          tokens={TOKENS}
          tree={tree([
            {
              nodeId: "boom",
              componentId: "comparison-table-v1",
              kind: "capability",
              variant: "default",
              orden: 1,
              props: { columnas: [{ nombre: "A" }, { nombre: "B" }], filas: [{ etiqueta: "x", valores: ["1", "2"] }] },
            },
            {
              nodeId: "ok",
              componentId: "process-visualizer-v1",
              kind: "capability",
              variant: "default",
              orden: 2,
              props: { pasos: [{ titulo: "Sigo vivo", descripcion: "a" }, { titulo: "B", descripcion: "b" }] },
            },
          ])}
        />
      );
      expect(screen.getByText(/no se pudo renderizar \(comparison-table-v1\)/)).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Sigo vivo" })).toBeInTheDocument();
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      (CAPABILITY_RENDER_MAP as Record<string, unknown>)["comparison-table-v1"] = original;
    }
  });

  it("una capability recibe props parseadas pero NO recibe variant (los componentes no lo declaran)", () => {
    render(
      <PageRenderer
        tokens={TOKENS}
        tree={tree([
          {
            nodeId: "n1",
            componentId: "comparison-table-v1",
            kind: "capability",
            variant: "default",
            orden: 1,
            props: { columnas: [{ nombre: "Uno" }, { nombre: "Dos" }], filas: [{ etiqueta: "fila", valores: ["a", "b"] }] },
          },
        ])}
      />
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Uno")).toBeInTheDocument();
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
