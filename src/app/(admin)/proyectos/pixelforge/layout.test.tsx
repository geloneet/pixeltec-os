// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";

// Este archivo no usa `globals: true` de Vitest (ver vitest.config.ts), así
// que el auto-cleanup de Testing Library entre tests no se dispara solo
// (depende de detectar un `afterEach` global). Lo registramos explícito para
// no arrastrar el DOM del test anterior entre los dos `it()` de este archivo.
afterEach(() => cleanup());

// `next/font/google` se resuelve en build real vía el plugin SWC de Next.js;
// bajo Vitest el módulo real (node_modules/next/font/google) está vacío y no
// expone `IBM_Plex_Mono`, así que lo mockeamos con la forma mínima que usa
// el layout: una función que devuelve `{ variable }` (la clase que expone la
// custom property de la fuente), igual que hace next/font en runtime.
vi.mock("next/font/google", () => ({
  IBM_Plex_Mono: () => ({ variable: "mock-pfx-font-mono-src" }),
}));

import PixelforgeModuleLayout from "./layout";

describe("PixelforgeModuleLayout", () => {
  it("envuelve a los children en [data-product=\"pixelforge\"]", () => {
    render(
      <PixelforgeModuleLayout>
        <p>contenido de la ruta</p>
      </PixelforgeModuleLayout>
    );

    const scope = screen.getByText("contenido de la ruta").closest('[data-product="pixelforge"]');
    expect(scope).toBeInTheDocument();
  });

  it("aplica la clase de la variable de fuente mono en el wrapper", () => {
    render(
      <PixelforgeModuleLayout>
        <p>contenido de la ruta</p>
      </PixelforgeModuleLayout>
    );

    const scope = screen.getByText("contenido de la ruta").closest('[data-product="pixelforge"]');
    expect(scope).toHaveClass("mock-pfx-font-mono-src");
  });
});
