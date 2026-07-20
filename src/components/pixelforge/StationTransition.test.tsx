// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";

afterEach(cleanup);

const { usePathnameMock } = vi.hoisted(() => ({
  usePathnameMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
}));

import { StationTransition } from "./StationTransition";

describe("StationTransition", () => {
  it("renderiza los hijos envueltos en la clase de crossfade escopada", () => {
    usePathnameMock.mockReturnValue("/proyectos/pixelforge/proj-1/contexto");
    const { container } = render(
      <StationTransition>
        <p>Contenido de la estación</p>
      </StationTransition>
    );
    expect(screen.getByText("Contenido de la estación")).toBeInTheDocument();
    expect(container.querySelector(".pfx-station-fade")).not.toBeNull();
  });

  it("usa el pathname como key: cambiar de estación remonta el wrapper (nueva instancia, nueva animación)", () => {
    usePathnameMock.mockReturnValue("/proyectos/pixelforge/proj-1/contexto");
    const { container, rerender } = render(
      <StationTransition>
        <p>Contexto</p>
      </StationTransition>
    );
    const first = container.querySelector(".pfx-station-fade");

    usePathnameMock.mockReturnValue("/proyectos/pixelforge/proj-1/estrategia");
    rerender(
      <StationTransition>
        <p>Estrategia</p>
      </StationTransition>
    );
    const second = container.querySelector(".pfx-station-fade");

    // Distinta key (pathname) => React desmonta el nodo viejo y monta uno
    // nuevo en su lugar, no lo reutiliza in-place.
    expect(second).not.toBe(first);
    expect(screen.getByText("Estrategia")).toBeInTheDocument();
    expect(screen.queryByText("Contexto")).not.toBeInTheDocument();
  });
});
