// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { DefinitionStatusBadge } from "./DefinitionStatusBadge";

describe("DefinitionStatusBadge", () => {
  it("muestra 'Completo' cuando status es completed", () => {
    render(<DefinitionStatusBadge status="completed" currentStation="flujo" />);
    expect(screen.getByText("Completo")).toBeInTheDocument();
  });

  it("muestra 'Borrador' cuando status es draft, sin importar la estación", () => {
    render(<DefinitionStatusBadge status="draft" currentStation="boceto" />);
    expect(screen.getByText("Borrador")).toBeInTheDocument();
  });

  it("muestra el stepLabel de la estación actual cuando está in_progress", () => {
    render(<DefinitionStatusBadge status="in_progress" currentStation="mvp" />);
    expect(screen.getByText("Recorte MVP")).toBeInTheDocument();
  });
});
