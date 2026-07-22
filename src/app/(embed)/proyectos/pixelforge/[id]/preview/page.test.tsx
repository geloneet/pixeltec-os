// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
// `getQaRunWithFindings`/`getPageVersionById` solo los usa la rama `?pfqa`
// (PF-F8 T3) — el flujo de sesión de siempre no los toca.
const getQaRunWithFindingsMock = vi.fn();
const getPageVersionByIdMock = vi.fn();
vi.mock("@/lib/db/repos/pixelforge", () => ({
  getPixelforgeProjectFull: (...args: unknown[]) => getPixelforgeProjectFullMock(...args),
  getLatestPageVersion: (...args: unknown[]) => getLatestPageVersionMock(...args),
  getQaRunWithFindings: (...args: unknown[]) => getQaRunWithFindingsMock(...args),
  getPageVersionById: (...args: unknown[]) => getPageVersionByIdMock(...args),
}));

// `redirect()`/`notFound()` de `next/navigation` dependen del request context
// de Next (throws especiales) que no existe bajo Vitest — no deberían
// dispararse en estos caminos (proyecto siempre encontrado), pero se mockean
// para no arrastrar el módulo real si algún día cambia el orden de checks.
// La rama `?pfqa` (PF-F8 T3) SÍ ejercita `notFound()` a propósito en sus
// propios tests — de ahí que el mock se importe más abajo para poder
// aseverar sobre sus llamadas (misma instancia: `vi.mock` reemplaza el
// módulo para todo el archivo, page.tsx incluido).
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
import { notFound } from "next/navigation";
import { signQaPreviewToken, type QaPreviewTokenPayload } from "@/lib/pixelforge/qa/preview-token";
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

// ─── Rama `?pfqa=` (PF-F8 T3) ───────────────────────────────────────────────
// El qa-runner (T6, sin sesión de usuario) carga esta ruta con un token HMAC
// efímero para revisar una versión EXACTA — la identidad de la rama es la del
// `ownerId` DEL TOKEN, nunca la de `auth()` (de hecho `auth()` ni se llama en
// esta rama: por eso el mock de sesión de arriba, fijo a "owner-1", es
// irrelevante aquí a propósito).
describe("PixelforgePreviewPage — rama ?pfqa (PF-F8 T3)", () => {
  const PROJECT_ID = BASE_FULL.project.id;
  const TOKEN_OWNER_ID = "owner-del-token";
  const SECRET = "secreto-de-prueba-qa-preview";

  function basePayload(overrides: Partial<QaPreviewTokenPayload> = {}): QaPreviewTokenPayload {
    return {
      qaRunId: "qa-run-1",
      projectId: PROJECT_ID,
      pageVersionId: "v1",
      ownerId: TOKEN_OWNER_ID,
      exp: Math.floor(Date.now() / 1000) + 600,
      ...overrides,
    };
  }

  function runningQaRun(overrides: Partial<{ status: string; projectId: string; pageVersionId: string }> = {}) {
    return {
      run: {
        id: "qa-run-1",
        projectId: PROJECT_ID,
        pageVersionId: "v1",
        status: "running",
        ...overrides,
      },
      findings: [],
    };
  }

  beforeEach(() => {
    process.env.QA_PREVIEW_TOKEN_SECRET = SECRET;
    vi.mocked(notFound).mockClear();
    getPixelforgeProjectFullMock.mockReset();
    getQaRunWithFindingsMock.mockReset();
    getPageVersionByIdMock.mockReset();
    getLatestPageVersionMock.mockReset();
  });

  afterEach(() => {
    delete process.env.QA_PREVIEW_TOKEN_SECRET;
  });

  it("renderiza LA versión del token (v1) aunque exista una versión más nueva (v2)", async () => {
    const token = signQaPreviewToken(basePayload(), SECRET);

    getQaRunWithFindingsMock.mockResolvedValue(runningQaRun());
    getPixelforgeProjectFullMock.mockResolvedValue(BASE_FULL);
    getPageVersionByIdMock.mockResolvedValue({
      id: "v1",
      version: 1,
      tree: realVersionTree(),
      notas: "v1",
      warnings: [],
      createdByName: "IA",
      createdAt: new Date("2026-07-20T00:00:00Z"),
    });
    // Una v2 "más nueva" existe — si la rama pfqa se equivocara y usara
    // `getLatestPageVersion` en vez del `pageVersionId` del token, este
    // contenido exclusivo de v2 se colaría.
    getLatestPageVersionMock.mockResolvedValue({
      id: "v2",
      version: 2,
      tree: {
        notas: "v2",
        nodes: [
          {
            nodeId: "hero-v2",
            componentId: "hero-split",
            variant: "media-right",
            orden: 1,
            propsJson: JSON.stringify({
              titulo: "Contenido EXCLUSIVO de la versión 2",
              subtitulo: "No debería aparecer en el preview de QA sobre v1.",
              cta: { label: "Ir", href: "/" },
              mediaAlt: "media",
              badges: [],
            }),
          },
        ],
      },
      notas: "v2",
      warnings: [],
      createdByName: "IA",
      createdAt: new Date("2026-07-21T00:00:00Z"),
    });

    render(
      await PixelforgePreviewPage({
        params: Promise.resolve({ id: PROJECT_ID }),
        searchParams: Promise.resolve({ pfqa: token }),
      })
    );

    // Contenido de v1 (el que ancla el token) presente.
    expect(screen.getByText("Bienvenido a la landing compuesta de Acme")).toBeInTheDocument();
    // Contenido EXCLUSIVO de v2 ausente — la rama pfqa no "subió" a la vigente.
    expect(screen.queryByText("Contenido EXCLUSIVO de la versión 2")).not.toBeInTheDocument();
    // La identidad usada en TODAS las queries de la rama es la del token, no "owner-1" (sesión).
    expect(getQaRunWithFindingsMock).toHaveBeenCalledWith("qa-run-1", TOKEN_OWNER_ID);
    expect(getPixelforgeProjectFullMock).toHaveBeenCalledWith(PROJECT_ID, TOKEN_OWNER_ID);
    expect(getPageVersionByIdMock).toHaveBeenCalledWith(PROJECT_ID, "v1", TOKEN_OWNER_ID);
    // La rama pfqa nunca debió consultar "la vigente".
    expect(getLatestPageVersionMock).not.toHaveBeenCalled();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("token con formato basura → notFound, sin crash", async () => {
    render(
      await PixelforgePreviewPage({
        params: Promise.resolve({ id: PROJECT_ID }),
        searchParams: Promise.resolve({ pfqa: "esto-no-es-un-token-valido" }),
      })
    );
    expect(notFound).toHaveBeenCalled();
    expect(getQaRunWithFindingsMock).not.toHaveBeenCalled();
  });

  it("token expirado → notFound", async () => {
    const token = signQaPreviewToken(basePayload({ exp: Math.floor(Date.now() / 1000) - 10 }), SECRET);
    render(
      await PixelforgePreviewPage({
        params: Promise.resolve({ id: PROJECT_ID }),
        searchParams: Promise.resolve({ pfqa: token }),
      })
    );
    expect(notFound).toHaveBeenCalled();
    expect(getQaRunWithFindingsMock).not.toHaveBeenCalled();
  });

  it("QA_PREVIEW_TOKEN_SECRET ausente en el entorno → notFound (la rama entera deshabilitada)", async () => {
    delete process.env.QA_PREVIEW_TOKEN_SECRET;
    const token = signQaPreviewToken(basePayload(), SECRET);
    render(
      await PixelforgePreviewPage({
        params: Promise.resolve({ id: PROJECT_ID }),
        searchParams: Promise.resolve({ pfqa: token }),
      })
    );
    expect(notFound).toHaveBeenCalled();
    expect(getQaRunWithFindingsMock).not.toHaveBeenCalled();
  });

  it("projectId del payload distinto al de la ruta → notFound (defensa 1)", async () => {
    const token = signQaPreviewToken(basePayload({ projectId: "otro-proyecto" }), SECRET);
    render(
      await PixelforgePreviewPage({
        params: Promise.resolve({ id: PROJECT_ID }),
        searchParams: Promise.resolve({ pfqa: token }),
      })
    );
    expect(notFound).toHaveBeenCalled();
    expect(getQaRunWithFindingsMock).not.toHaveBeenCalled();
  });

  it("qa_run inexistente para ese ownerId → notFound", async () => {
    const token = signQaPreviewToken(basePayload(), SECRET);
    getQaRunWithFindingsMock.mockResolvedValue(null);
    render(
      await PixelforgePreviewPage({
        params: Promise.resolve({ id: PROJECT_ID }),
        searchParams: Promise.resolve({ pfqa: token }),
      })
    );
    expect(notFound).toHaveBeenCalled();
    expect(getPixelforgeProjectFullMock).not.toHaveBeenCalled();
  });

  it("qa_run que ya NO está running (p.ej. pass/fail) → notFound", async () => {
    const token = signQaPreviewToken(basePayload(), SECRET);
    getQaRunWithFindingsMock.mockResolvedValue(runningQaRun({ status: "pass" }));
    render(
      await PixelforgePreviewPage({
        params: Promise.resolve({ id: PROJECT_ID }),
        searchParams: Promise.resolve({ pfqa: token }),
      })
    );
    expect(notFound).toHaveBeenCalled();
    expect(getPixelforgeProjectFullMock).not.toHaveBeenCalled();
  });

  it("qa_run cuyo pageVersionId NO coincide con el del token → notFound (defensa 2)", async () => {
    const token = signQaPreviewToken(basePayload(), SECRET);
    getQaRunWithFindingsMock.mockResolvedValue(runningQaRun({ pageVersionId: "v-distinta" }));
    render(
      await PixelforgePreviewPage({
        params: Promise.resolve({ id: PROJECT_ID }),
        searchParams: Promise.resolve({ pfqa: token }),
      })
    );
    expect(notFound).toHaveBeenCalled();
    expect(getPixelforgeProjectFullMock).not.toHaveBeenCalled();
  });

  it("qa_run cuyo projectId NO coincide con el del token → notFound (defensa 2)", async () => {
    const token = signQaPreviewToken(basePayload(), SECRET);
    getQaRunWithFindingsMock.mockResolvedValue(runningQaRun({ projectId: "otro-proyecto-en-el-run" }));
    render(
      await PixelforgePreviewPage({
        params: Promise.resolve({ id: PROJECT_ID }),
        searchParams: Promise.resolve({ pfqa: token }),
      })
    );
    expect(notFound).toHaveBeenCalled();
    expect(getPixelforgeProjectFullMock).not.toHaveBeenCalled();
  });
});
