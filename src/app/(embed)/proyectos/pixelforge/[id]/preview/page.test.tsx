// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";

// Este archivo no usa `globals: true` de Vitest (ver `vitest.config.ts`), así
// que el auto-cleanup de Testing Library no se dispara solo entre los `it()`
// de este archivo (mismo patrón que `layout.test.tsx` / `page.test.tsx` de la
// lista de proyectos).
afterEach(() => cleanup());

// `page.tsx` es un Server Component: llama `auth()` (next-auth) y a
// `getPixelforgeProjectFull` / `getLatestPageVersion` (Drizzle). Bajo Vitest
// no hay request context real de Next ni conexión a DB, así que mockeamos
// ambos límites, igual que `actions.test.ts` / `page.test.tsx` mockean
// `@/lib/auth/config` y `@/lib/db/repos/pixelforge`.
vi.mock("@/lib/auth/config", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "owner-1" } }),
}));

const getPixelforgeProjectFullMock = vi.fn();
const getLatestPageVersionMock = vi.fn();
vi.mock("@/lib/db/repos/pixelforge", () => ({
  getPixelforgeProjectFull: (...args: unknown[]) => getPixelforgeProjectFullMock(...args),
  getLatestPageVersion: (...args: unknown[]) => getLatestPageVersionMock(...args),
}));

// `redirect()`/`notFound()` de `next/navigation` dependen del request context
// de Next (throws especiales) que no existe bajo Vitest — no deberían
// dispararse en estos caminos (proyecto siempre encontrado), pero se mockean
// para no arrastrar el módulo real si algún día cambia el orden de checks.
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));

// El escenario "sin versión" renderiza `PREVIEW_FIXTURE_TREE` completo, que
// incluye nodos con `choreography` (motion cinemático). `MotionSection` real
// usa framer-motion/IntersectionObserver, que no está disponible bajo jsdom
// sin polyfills — mismo mock que `PageRenderer.test.tsx` usa para no
// re-testear motion aquí (eso vive en `MotionSection.test.tsx`).
vi.mock("@/components/pixelforge/render/motion/MotionSection", () => ({
  MotionSection: ({ children }: { children: React.ReactNode }) => children,
}));

import type React from "react";
import PixelforgePreviewPage from "./page";

const BASE_FULL = {
  project: {
    id: "11111111-1111-1111-1111-111111111111",
    chosenDirectionId: null,
  },
  directions: [],
};

// Árbol válido mínimo (mismo patrón que `compose-page-tree.test.ts` /
// `registry/validate-page-tree.test.ts`: 3 nodos, blocks reales del registry),
// con texto DISTINTO al del fixture (`PREVIEW_FIXTURE_TREE`) para poder
// distinguir "renderizó la versión real" de "renderizó el fixture".
const REAL_HERO_PROPS = {
  titulo: "Bienvenido a la landing compuesta de Acme",
  subtitulo: "Este contenido viene de una page_version real, no del fixture.",
  cta: { label: "Contactar a Acme", href: "/contacto" },
  mediaAlt: "Equipo de Acme trabajando",
  badges: [],
};
const REAL_FEATURES_PROPS = {
  titulo: "Por qué elegir Acme",
  features: [
    { titulo: "Rápido", texto: "Entregamos en tiempo récord." },
    { titulo: "Confiable", texto: "Garantía por escrito." },
    { titulo: "Local", texto: "Equipo en tu ciudad." },
  ],
};
const REAL_FOOTER_PROPS = {
  empresa: "Acme Corp",
  links: [],
};

function realVersionTree() {
  return {
    notas: "Página compuesta real de Acme.",
    nodes: [
      {
        nodeId: "hero-1",
        componentId: "hero-split",
        variant: "media-right",
        orden: 1,
        propsJson: JSON.stringify(REAL_HERO_PROPS),
      },
      {
        nodeId: "features-1",
        componentId: "feature-grid",
        variant: "3-col",
        orden: 2,
        propsJson: JSON.stringify(REAL_FEATURES_PROPS),
      },
      {
        nodeId: "footer-1",
        componentId: "footer-contact",
        variant: "default",
        orden: 3,
        propsJson: JSON.stringify(REAL_FOOTER_PROPS),
      },
    ],
  };
}

describe("PixelforgePreviewPage — con page_version vigente (PF-F7 T4, D5)", () => {
  it("renderiza el árbol REAL de la versión (contenido de la versión presente, contenido del fixture ausente)", async () => {
    getPixelforgeProjectFullMock.mockResolvedValue(BASE_FULL);
    getLatestPageVersionMock.mockResolvedValue({
      id: "v1",
      version: 1,
      tree: realVersionTree(),
      notas: "Página compuesta real de Acme.",
      warnings: [],
      createdByName: "IA",
      createdAt: new Date("2026-07-20T00:00:00Z"),
    });

    render(
      await PixelforgePreviewPage({ params: Promise.resolve({ id: BASE_FULL.project.id }) })
    );

    // Contenido de la versión real presente.
    expect(screen.getByText("Bienvenido a la landing compuesta de Acme")).toBeInTheDocument();
    expect(screen.getByText("Por qué elegir Acme")).toBeInTheDocument();

    // Contenido EXCLUSIVO del fixture ausente — no se coló el fixture.
    expect(
      screen.queryByText("Automatiza tu operación sin perder el control")
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Empresas que ya operan con nosotros")).not.toBeInTheDocument();
  });
});

describe("PixelforgePreviewPage — sin ninguna page_version (comportamiento existente)", () => {
  it("renderiza el fixture cuando el proyecto todavía no compuso ninguna versión", async () => {
    getPixelforgeProjectFullMock.mockResolvedValue(BASE_FULL);
    getLatestPageVersionMock.mockResolvedValue(null);

    render(
      await PixelforgePreviewPage({ params: Promise.resolve({ id: BASE_FULL.project.id }) })
    );

    expect(
      screen.getByText("Automatiza tu operación sin perder el control")
    ).toBeInTheDocument();
  });
});

describe("PixelforgePreviewPage — page_version corrupta (D5)", () => {
  it("lanza con un mensaje de corrupción distinto al del fixture inválido", async () => {
    getPixelforgeProjectFullMock.mockResolvedValue(BASE_FULL);
    getLatestPageVersionMock.mockResolvedValue({
      id: "v1",
      version: 1,
      // `componentId` inexistente — falla en `validatePageTree` con la fila ya
      // "en teoría" válida (la puerta corrió en el insert): esto simula
      // corrupción real de la fila persistida, no un árbol mal compuesto.
      tree: {
        notas: "corrupto",
        nodes: [
          { nodeId: "n1", componentId: "bloque-fantasma", variant: "default", orden: 1, propsJson: "{}" },
          { nodeId: "n2", componentId: "bloque-fantasma-2", variant: "default", orden: 2, propsJson: "{}" },
          { nodeId: "n3", componentId: "bloque-fantasma-3", variant: "default", orden: 3, propsJson: "{}" },
        ],
      },
      notas: "corrupto",
      warnings: [],
      createdByName: "IA",
      createdAt: new Date("2026-07-20T00:00:00Z"),
    });

    await expect(
      PixelforgePreviewPage({ params: Promise.resolve({ id: BASE_FULL.project.id }) })
    ).rejects.toThrow(/La versión compuesta del proyecto está corrupta/);
  });
});
