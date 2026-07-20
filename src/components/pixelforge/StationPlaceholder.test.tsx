// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { StationPlaceholder } from "./StationPlaceholder";
import { getStationMeta } from "@/lib/pixelforge/station-meta";

describe("StationPlaceholder", () => {
  it("renderiza el título y el hint de la estación", () => {
    const meta = getStationMeta("produccion");
    render(<StationPlaceholder station="produccion" />);
    expect(screen.getByText(meta.title)).toBeInTheDocument();
    expect(screen.getByText(meta.hint)).toBeInTheDocument();
  });

  it("usa tokens pfx en título y hint (sin tokens globales del OS)", () => {
    render(<StationPlaceholder station="qa" />);
    const meta = getStationMeta("qa");
    expect(screen.getByText(meta.title)).toHaveClass("text-pfx-text");
    expect(screen.getByText(meta.hint)).toHaveClass("text-pfx-text-muted");
  });

  it("muestra el chip de fase con materialidad locked (borde punteado + mono)", () => {
    render(<StationPlaceholder station="revision" />);
    const meta = getStationMeta("revision");
    const chip = screen.getByText(`Se habilita en la Fase ${meta.phase}`).closest("span");
    expect(chip).toHaveClass("font-forge-mono");
    expect(chip).toHaveClass("border-dashed");
    expect(chip).toHaveClass("border-pfx-forge-locked");
  });
});
