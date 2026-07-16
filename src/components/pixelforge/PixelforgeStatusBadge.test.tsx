// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { PixelforgeStatusBadge } from "./PixelforgeStatusBadge";

describe("PixelforgeStatusBadge", () => {
  it("muestra 'Borrador' cuando status es draft", () => {
    render(<PixelforgeStatusBadge status="draft" currentStation="contexto" />);
    expect(screen.getByText("Borrador")).toBeInTheDocument();
  });

  it("muestra 'En progreso' y el stepLabel de la estación actual cuando status es in_progress", () => {
    render(<PixelforgeStatusBadge status="in_progress" currentStation="estrategia" />);
    expect(screen.getByText("En progreso")).toBeInTheDocument();
    expect(screen.getByText("Estrategia")).toBeInTheDocument();
  });

  it("muestra 'Completada' cuando status es completed", () => {
    render(<PixelforgeStatusBadge status="completed" currentStation="blueprint" />);
    expect(screen.getByText("Completada")).toBeInTheDocument();
  });

  it("muestra 'Aprobado' cuando status es approved", () => {
    render(<PixelforgeStatusBadge status="approved" currentStation="revision" />);
    expect(screen.getByText("Aprobado")).toBeInTheDocument();
  });
});
