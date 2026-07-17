// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { PreviewFrame } from "./PreviewFrame";

afterEach(cleanup);

describe("PreviewFrame", () => {
  it("apunta el iframe a la ruta preview del proyecto", () => {
    render(<PreviewFrame projectId="proj-42" />);
    const iframe = screen.getByTitle("Vista previa de la landing") as HTMLIFrameElement;
    expect(iframe.getAttribute("src")).toBe("/proyectos/pixelforge/proj-42/preview");
  });

  it("arranca en Desktop (1280px)", () => {
    render(<PreviewFrame projectId="p1" />);
    const iframe = screen.getByTitle("Vista previa de la landing") as HTMLIFrameElement;
    expect(iframe.style.width).toBe("1280px");
  });

  it("cambiar de dispositivo cambia el ancho del iframe", () => {
    render(<PreviewFrame projectId="p1" />);
    const iframe = () => screen.getByTitle("Vista previa de la landing") as HTMLIFrameElement;

    fireEvent.click(screen.getByRole("button", { name: /Tablet/i }));
    expect(iframe().style.width).toBe("768px");

    fireEvent.click(screen.getByRole("button", { name: /Móvil/i }));
    expect(iframe().style.width).toBe("390px");

    fireEvent.click(screen.getByRole("button", { name: /Desktop/i }));
    expect(iframe().style.width).toBe("1280px");
  });

  it('el botón activo se marca con aria-pressed', () => {
    render(<PreviewFrame projectId="p1" />);
    expect(screen.getByRole("button", { name: /Desktop/i })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /Móvil/i }));
    expect(screen.getByRole("button", { name: /Móvil/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Desktop/i })).toHaveAttribute("aria-pressed", "false");
  });

  it('"Abrir en pestaña" enlaza a la misma ruta preview en _blank', () => {
    render(<PreviewFrame projectId="proj-42" />);
    const link = screen.getByRole("link", { name: /Abrir en pestaña/i });
    expect(link).toHaveAttribute("href", "/proyectos/pixelforge/proj-42/preview");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
