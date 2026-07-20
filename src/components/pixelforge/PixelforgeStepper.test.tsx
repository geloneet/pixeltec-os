// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PixelforgeStepper } from "./PixelforgeStepper";
import { PIXELFORGE_STATION_SEQUENCE, type PixelforgeArtifactStatus, type PixelforgeStation } from "@/lib/pixelforge/types";

// Sin `test.globals` en vitest.config.ts, @testing-library/react no
// auto-registra el cleanup entre tests — necesario aquí porque varios tests
// usan `screen.getAllByText`/`getByText` (consultan document.body completo,
// no un `container` aislado) y CADA render monta las 8 estaciones: sin
// cleanup, un render previo deja restos que duplican coincidencias de texto
// (p.ej. el label "Direcciones" de la estación 4, presente en todo render).
afterEach(cleanup);

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

  it("las estaciones no alcanzadas son segmentos 'locked' (hueco punteado)", () => {
    const { container } = render(
      <PixelforgeStepper projectId="proj-1" statuses={allPending} current="contexto" />
    );
    // Todas las estaciones salvo la activa quedan "locked" cuando todo está pending.
    const locked = container.querySelectorAll('a[data-state="locked"]');
    expect(locked).toHaveLength(7);
    // Materialidad de forma: contorno punteado + ícono Lock (svg), sin número.
    expect(locked[0]?.querySelector(".lucide-lock")).not.toBeNull();
  });

  it("la estación sellada es un segmento 'sealed' (acero + check grabado)", () => {
    const statuses = { ...allPending, contexto: "sealed" as PixelforgeArtifactStatus };
    const { container } = render(
      <PixelforgeStepper projectId="proj-1" statuses={statuses} current="estrategia" />
    );
    const sealed = container.querySelector('a[data-state="sealed"]');
    expect(sealed).not.toBeNull();
    expect(sealed?.querySelector(".lucide-check")).not.toBeNull();
    // Sin aria-current: sealed no es la estación activa.
    expect(sealed).not.toHaveAttribute("aria-current");
  });

  it("marca la estación activa (ruta actual) con data-state='active' y aria-current='step'", () => {
    const { container } = render(
      <PixelforgeStepper projectId="proj-1" statuses={allPending} current="visual" />
    );
    const active = container.querySelector('a[data-state="active"]');
    expect(active).not.toBeNull();
    expect(active).toHaveAttribute("aria-current", "step");
    expect(active).toHaveAttribute("href", "/proyectos/pixelforge/proj-1/visual");
  });

  it("no marca aria-current en ninguna estación cuando el proceso está completo", () => {
    const { container } = render(
      <PixelforgeStepper projectId="proj-1" statuses={allPending} current="visual" completed />
    );
    expect(container.querySelector("[aria-current]")).toBeNull();
  });

  it("la estación invalidada es un segmento con fisura ámbar + RotateCcw", () => {
    const statuses = { ...allPending, contexto: "invalidated" as PixelforgeArtifactStatus };
    const { container } = render(
      <PixelforgeStepper projectId="proj-1" statuses={statuses} current="estrategia" />
    );
    const invalid = container.querySelector('a[data-state="invalidated"]');
    expect(invalid).not.toBeNull();
    expect(invalid?.querySelector(".lucide-rotate-ccw")).not.toBeNull();
  });

  it("los labels usan tokens pfx a intensidad plena (sin opacidad recortada) para sostener AA", () => {
    const statuses = { ...allPending, contexto: "sealed" as PixelforgeArtifactStatus };
    const { container } = render(
      <PixelforgeStepper projectId="proj-1" statuses={statuses} current="visual" />
    );
    const labels = container.querySelectorAll("a > span:last-child");
    for (const label of Array.from(labels)) {
      const opacityModified = Array.from(label.classList).some((c) => c.includes("/"));
      expect(opacityModified).toBe(false);
    }
  });

  it("expone el nombre de la estación actual para móvil (compacto: solo segmentos + nombre)", () => {
    render(<PixelforgeStepper projectId="proj-1" statuses={allPending} current="direcciones" />);
    // Aparece dos veces: el label mono bajo el segmento (desktop, oculto en
    // móvil vía CSS) y el nombre de estación actual bajo el riel (móvil).
    expect(screen.getAllByText("Direcciones")).toHaveLength(2);
  });
});
