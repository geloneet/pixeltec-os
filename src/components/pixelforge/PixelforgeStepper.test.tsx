// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { PixelforgeStepper } from "./PixelforgeStepper";
import { PIXELFORGE_STATION_SEQUENCE, type PixelforgeArtifactStatus, type PixelforgeStation } from "@/lib/pixelforge/types";

const allPending: Record<PixelforgeStation, PixelforgeArtifactStatus> = Object.fromEntries(
  PIXELFORGE_STATION_SEQUENCE.map((s) => [s, "pending"])
) as Record<PixelforgeStation, PixelforgeArtifactStatus>;

describe("PixelforgeStepper", () => {
  it("renderiza los 8 pasos con link a la ruta de cada estación", () => {
    render(<PixelforgeStepper projectId="proj-1" statuses={allPending} current="contexto" />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(8);
    expect(links[0]).toHaveAttribute("href", "/proyectos/pixelforge/proj-1/contexto");
    expect(links[1]).toHaveAttribute("href", "/proyectos/pixelforge/proj-1/estrategia");
    expect(links[7]).toHaveAttribute("href", "/proyectos/pixelforge/proj-1/revision");
  });

  it("muestra check en las estaciones selladas", () => {
    const statuses = { ...allPending, contexto: "sealed" as PixelforgeArtifactStatus };
    const { container } = render(
      <PixelforgeStepper projectId="proj-1" statuses={statuses} current="estrategia" />
    );
    // El círculo sellado usa fondo cyan-500 sólido.
    expect(container.querySelector(".bg-cyan-500.text-white")).not.toBeNull();
  });

  it("marca la estación activa (ruta actual) con borde cyan", () => {
    const { container } = render(
      <PixelforgeStepper projectId="proj-1" statuses={allPending} current="visual" />
    );
    expect(container.querySelector(".border-cyan-500.text-cyan-400")).not.toBeNull();
  });
});
