// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { ForgeZone, type ForgeState } from "./ForgeZone";
import { ForgeSeam } from "./ForgeSeam";
import { ForgeStamp } from "./ForgeStamp";
import { ForgeStationBadge } from "./ForgeStationBadge";

describe("ForgeZone", () => {
  const STATES: ForgeState[] = [
    "draft",
    "forging",
    "sealed",
    "locked",
    "invalidated",
  ];

  it("por defecto es draft, div y superficie base", () => {
    const { container } = render(<ForgeZone>contenido</ForgeZone>);
    const zone = container.querySelector(".forge-zone");
    expect(zone).not.toBeNull();
    expect(zone?.tagName).toBe("DIV");
    expect(zone).toHaveAttribute("data-state", "draft");
    expect(zone).toHaveClass("forge-zone--draft", "bg-pfx-surface");
  });

  it.each(STATES)("emite data-state y la clase de materialidad para %s", (state) => {
    const { container } = render(<ForgeZone state={state}>x</ForgeZone>);
    const zone = container.querySelector(".forge-zone");
    expect(zone).toHaveAttribute("data-state", state);
    expect(zone).toHaveClass(`forge-zone--${state}`);
  });

  it("sealed lleva la clase que activa el notch (clip-path en CSS)", () => {
    const { container } = render(<ForgeZone state="sealed">x</ForgeZone>);
    // La clase .forge-zone--sealed es la que aplica clip-path + notch en el CSS
    // escopado; jsdom no computa clip-path, se verifica la clase que lo dispara.
    expect(container.querySelector(".forge-zone--sealed")).not.toBeNull();
  });

  it("locked lleva la clase que dibuja el contorno punteado y atenúa el contenido", () => {
    const { container } = render(
      <ForgeZone state="locked">
        <span>gated</span>
      </ForgeZone>,
    );
    expect(container.querySelector(".forge-zone--locked")).not.toBeNull();
    // El contenido se envuelve para poder atenuarlo al 55% sin tocar el perímetro.
    expect(container.querySelector(".forge-zone__content")).not.toBeNull();
    expect(screen.getByText("gated")).toBeInTheDocument();
  });

  it("draft/forging/invalidated exponen la veta izquierda por clase de estado", () => {
    for (const state of ["draft", "forging", "invalidated"] as ForgeState[]) {
      const { container } = render(<ForgeZone state={state}>x</ForgeZone>);
      expect(container.querySelector(`.forge-zone--${state}`)).not.toBeNull();
    }
  });

  it("la animación de forging es CSS-only: sin animación por JS ni style inline", () => {
    // La veta fluye vía background-position en pixelforge-theme.css, gated por
    // @media (prefers-reduced-motion: reduce). El componente NO usa JS de
    // animación: no hay atributo style con animation ni framer-motion.
    const { container } = render(<ForgeZone state="forging">x</ForgeZone>);
    const zone = container.querySelector(".forge-zone--forging") as HTMLElement;
    expect(zone).not.toBeNull();
    expect(zone.getAttribute("style") ?? "").not.toContain("animation");
  });

  it("variant elevated usa la superficie elevada y respeta className/as", () => {
    const { container } = render(
      <ForgeZone variant="elevated" as="section" className="extra">
        x
      </ForgeZone>,
    );
    const zone = container.querySelector(".forge-zone");
    expect(zone?.tagName).toBe("SECTION");
    expect(zone).toHaveClass("bg-pfx-surface-elevated", "extra");
  });
});

describe("ForgeSeam", () => {
  it("renderiza un separador (hr) con la clase de veta", () => {
    const { container } = render(<ForgeSeam />);
    const seam = container.querySelector("hr.forge-seam");
    expect(seam).not.toBeNull();
    expect(seam).not.toHaveClass("forge-seam--strong");
  });

  it("la variante strong añade la clase de veta reforzada", () => {
    const { container } = render(<ForgeSeam strong />);
    expect(container.querySelector("hr.forge-seam--strong")).not.toBeNull();
  });
});

describe("ForgeStamp", () => {
  it("formatea la estampa es-MX como 'SELLADO · 18 jul 2026' para 2026-07-18", () => {
    render(<ForgeStamp sealedAt="2026-07-18" />);
    expect(screen.getByText("SELLADO · 18 jul 2026")).toBeInTheDocument();
  });

  it("es mono y en acero sellado", () => {
    const { container } = render(<ForgeStamp sealedAt="2026-01-05" />);
    const stamp = container.querySelector("span");
    expect(stamp).toHaveClass("font-forge-mono", "text-pfx-forge-sealed");
    // 05 ene 2026 — día 2 dígitos, mes abreviado sin punto.
    expect(screen.getByText("SELLADO · 05 ene 2026")).toBeInTheDocument();
  });
});

describe("ForgeStationBadge", () => {
  it("muestra 'Borrador' cuando status es draft", () => {
    render(<ForgeStationBadge status="draft" currentStation="contexto" />);
    expect(screen.getByText("Borrador")).toBeInTheDocument();
  });

  it("muestra 'En progreso' y el stepLabel de la estación actual cuando status es in_progress", () => {
    render(<ForgeStationBadge status="in_progress" currentStation="estrategia" />);
    expect(screen.getByText("En progreso")).toBeInTheDocument();
    expect(screen.getByText("Estrategia")).toBeInTheDocument();
  });

  it("muestra 'Completada' cuando status es completed", () => {
    render(<ForgeStationBadge status="completed" currentStation="blueprint" />);
    expect(screen.getByText("Completada")).toBeInTheDocument();
  });

  it("muestra 'Aprobado' cuando status es approved", () => {
    render(<ForgeStationBadge status="approved" currentStation="revision" />);
    expect(screen.getByText("Aprobado")).toBeInTheDocument();
  });
});
