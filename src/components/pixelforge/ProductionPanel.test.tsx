// @vitest-environment jsdom
// src/components/pixelforge/ProductionPanel.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ProductionVersionView } from "./ProductionPanel";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const { setRunDecisionActionMock, refreshMock, usePixelforgeRunMock } = vi.hoisted(() => ({
  setRunDecisionActionMock: vi.fn(),
  refreshMock: vi.fn(),
  usePixelforgeRunMock: vi.fn(),
}));

vi.mock("@/app/(admin)/proyectos/pixelforge/actions", () => ({
  setRunDecisionAction: setRunDecisionActionMock,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));
vi.mock("@/hooks/pixelforge/use-pixelforge-run", () => ({
  usePixelforgeRun: usePixelforgeRunMock,
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { ProductionPanel } from "./ProductionPanel";

function versionFixture(overrides: Partial<ProductionVersionView> = {}): ProductionVersionView {
  return {
    id: "ver-1",
    version: 1,
    notas: "Se usó la capability de testimonios reales del cliente.",
    warnings: [],
    createdByName: "Miguel Robles",
    createdAt: "2026-07-18T12:00:00.000Z",
    ...overrides,
  };
}

describe("ProductionPanel", () => {
  beforeEach(() => {
    usePixelforgeRunMock.mockReturnValue({ run: null, isPolling: false, error: undefined });
  });

  it("blueprint NO sellado y sin versiones: gate locked con hint y CTA disabled", () => {
    render(
      <ProductionPanel
        projectId="proj-1"
        blueprintSealed={false}
        blueprintSealedAt={null}
        versions={[]}
      />
    );
    expect(screen.getByText(/Sella el Blueprint para componer la landing/i)).toBeInTheDocument();
    expect(screen.getByText("Componer landing").closest("button")).toBeDisabled();
  });

  it("blueprint sellado y sin versiones: CTA habilitado; click hace POST con operation compose_page_tree", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ runId: "run-1", status: "running" }) });
    render(
      <ProductionPanel
        projectId="proj-1"
        blueprintSealed={true}
        blueprintSealedAt="2026-07-18T00:00:00.000Z"
        versions={[]}
      />
    );
    const button = screen.getByText("Componer landing").closest("button")!;
    expect(button).toBeEnabled();
    fireEvent.click(button);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/pixelforge/runs");
    expect(JSON.parse(init.body)).toEqual({ projectId: "proj-1", operation: "compose_page_tree" });
  });

  it("corrida en curso: muestra el banner de forging", () => {
    usePixelforgeRunMock.mockReturnValue({
      run: { status: "running", progress: 40, currentStep: "Armando el árbol…" },
      isPolling: true,
      error: undefined,
    });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ runId: "run-1", status: "running" }) });
    render(
      <ProductionPanel
        projectId="proj-1"
        blueprintSealed={true}
        blueprintSealedAt="2026-07-18T00:00:00.000Z"
        versions={[]}
      />
    );
    fireEvent.click(screen.getByText("Componer landing"));
    expect(screen.getByText("Armando el árbol…")).toBeInTheDocument();
  });

  it("corrida fallida: muestra failureMessage y botón Reintentar", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Sella el Blueprint antes de componer la landing" }),
    });
    render(
      <ProductionPanel
        projectId="proj-1"
        blueprintSealed={true}
        blueprintSealedAt="2026-07-18T00:00:00.000Z"
        versions={[]}
      />
    );

    fireEvent.click(screen.getByText("Componer landing"));

    await screen.findByText(/Sella el Blueprint antes de componer la landing/i);
    expect(screen.getByText("Reintentar")).toBeInTheDocument();
  });

  it("con versión vigente: renderiza número mono, fecha/autor, notas y warnings como chips", () => {
    const versions = [
      versionFixture({
        id: "ver-2",
        version: 3,
        notas: "Fallback aplicado en el hero por falta de dato real.",
        warnings: ["El nodo hero-01 usó fallback por datos insuficientes"],
      }),
      versionFixture({ id: "ver-1", version: 2 }),
      versionFixture({ id: "ver-0", version: 1 }),
    ];
    render(
      <ProductionPanel
        projectId="proj-1"
        blueprintSealed={true}
        blueprintSealedAt="2026-07-10T00:00:00.000Z"
        versions={versions}
      />
    );

    // "v3" aparece tanto en la plancha de la vigente como en el historial (que
    // incluye la vigente) — se acota a "al menos una" en vez de una única
    // coincidencia.
    expect(screen.getAllByText("v3").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Miguel Robles/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Fallback aplicado en el hero por falta de dato real.")).toBeInTheDocument();
    expect(screen.getByText("El nodo hero-01 usó fallback por datos insuficientes")).toBeInTheDocument();
  });

  it("historial: lista todas las versiones en mono compacto (v, fecha, autor)", () => {
    const versions = [
      versionFixture({ id: "ver-2", version: 2, createdByName: "Ana" }),
      versionFixture({ id: "ver-1", version: 1, createdByName: "Miguel Robles" }),
    ];
    render(
      <ProductionPanel
        projectId="proj-1"
        blueprintSealed={true}
        blueprintSealedAt="2026-07-01T00:00:00.000Z"
        versions={versions}
      />
    );

    expect(screen.getByText("Historial de versiones")).toBeInTheDocument();
    // "v2" aparece tanto en la plancha de la vigente como en el historial —
    // se verifica que existan AL MENOS las dos entradas del historial ("v1"
    // solo puede venir del historial, la vigente es v2).
    expect(screen.getAllByText("v2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
  });

  it("obsolescencia: aviso visible cuando la vigente se compuso ANTES del sellado actual del blueprint", () => {
    const versions = [versionFixture({ createdAt: "2026-07-01T00:00:00.000Z" })];
    render(
      <ProductionPanel
        projectId="proj-1"
        blueprintSealed={true}
        blueprintSealedAt="2026-07-15T00:00:00.000Z"
        versions={versions}
      />
    );
    expect(
      screen.getByText(/La landing fue compuesta con un blueprint anterior — recompón para actualizarla/i)
    ).toBeInTheDocument();
  });

  it("sin obsolescencia: no muestra el aviso cuando la vigente es POSTERIOR al sellado del blueprint", () => {
    const versions = [versionFixture({ createdAt: "2026-07-20T00:00:00.000Z" })];
    render(
      <ProductionPanel
        projectId="proj-1"
        blueprintSealed={true}
        blueprintSealedAt="2026-07-15T00:00:00.000Z"
        versions={versions}
      />
    );
    expect(screen.queryByText(/blueprint anterior/i)).not.toBeInTheDocument();
  });

  it("Recomponer: tras confirmar, hace POST con operation compose_page_tree (crea nueva versión)", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ runId: "run-2", status: "running" }) });
    const versions = [versionFixture()];
    render(
      <ProductionPanel
        projectId="proj-1"
        blueprintSealed={true}
        blueprintSealedAt="2026-07-01T00:00:00.000Z"
        versions={versions}
      />
    );

    fireEvent.click(screen.getByText("Recomponer"));
    expect(screen.getByText("Esto crea una nueva versión")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Confirmar"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/pixelforge/runs");
    expect(JSON.parse(init.body)).toEqual({ projectId: "proj-1", operation: "compose_page_tree" });
  });

  it("Recomponer: cancelar vuelve al botón simple sin disparar POST", () => {
    const versions = [versionFixture()];
    render(
      <ProductionPanel
        projectId="proj-1"
        blueprintSealed={true}
        blueprintSealedAt="2026-07-01T00:00:00.000Z"
        versions={versions}
      />
    );

    fireEvent.click(screen.getByText("Recomponer"));
    fireEvent.click(screen.getByText("Cancelar"));

    expect(screen.getByText("Recomponer")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Recomponer deshabilitado si el blueprint se reabrió (ya no está sellado)", () => {
    const versions = [versionFixture()];
    render(
      <ProductionPanel
        projectId="proj-1"
        blueprintSealed={false}
        blueprintSealedAt="2026-07-01T00:00:00.000Z"
        versions={versions}
      />
    );
    expect(screen.getByText("Recomponer").closest("button")).toBeDisabled();
  });

  it("feedback: tras recomponer con éxito EN ESTA SESIÓN, aparecen los botones y llaman a setRunDecisionAction con el runId de la sesión", async () => {
    // Mismo criterio que `DirectionsPanel` (docstring de `ProductionPanel`):
    // el feedback depende de que YA haya contenido que mostrar (`current`
    // truthy) — con `versions` vacío el feedback nunca podría aparecer en la
    // MISMA sesión, porque el prop `versions` no cambia hasta que
    // `router.refresh()` (mockeado acá, no re-fetchea de verdad) resuelve.
    // Por eso se ejercita sobre un RECOMPONER (versión previa ya existente).
    setRunDecisionActionMock.mockResolvedValue({ success: true });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ runId: "run-3", status: "running" }) });
    usePixelforgeRunMock.mockReturnValue({
      run: { status: "succeeded", progress: 100, currentStep: null },
      isPolling: false,
      error: undefined,
    });
    render(
      <ProductionPanel
        projectId="proj-1"
        blueprintSealed={true}
        blueprintSealedAt="2026-07-01T00:00:00.000Z"
        versions={[versionFixture()]}
      />
    );

    fireEvent.click(screen.getByText("Recomponer"));
    fireEvent.click(screen.getByText("Confirmar"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(await screen.findByText("Útil")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Útil"));

    await waitFor(() =>
      expect(setRunDecisionActionMock).toHaveBeenCalledWith({ runId: "run-3", decision: "accepted" })
    );
    await screen.findByText(/gracias por el feedback/i);
  });

  it("sin corrida en esta sesión: no muestra los botones de feedback aunque ya haya versiones", () => {
    const versions = [versionFixture()];
    render(
      <ProductionPanel
        projectId="proj-1"
        blueprintSealed={true}
        blueprintSealedAt="2026-07-01T00:00:00.000Z"
        versions={versions}
      />
    );
    expect(screen.queryByText("Útil")).not.toBeInTheDocument();
    expect(screen.queryByText("No útil")).not.toBeInTheDocument();
  });

  describe("banner de cambios solicitados (T6 — visibilidad cross-estación)", () => {
    it("sin latestChangesRequestedReview: el banner no aparece", () => {
      render(
        <ProductionPanel
          projectId="proj-1"
          blueprintSealed={true}
          blueprintSealedAt="2026-07-01T00:00:00.000Z"
          versions={[versionFixture()]}
          latestChangesRequestedReview={null}
        />
      );
      expect(screen.queryByText(/cambios solicitados/i)).not.toBeInTheDocument();
    });

    it("con review changes_requested: banner con ronda, razón, destino legible y link a Revisión", () => {
      render(
        <ProductionPanel
          projectId="proj-1"
          blueprintSealed={true}
          blueprintSealedAt="2026-07-01T00:00:00.000Z"
          versions={[versionFixture()]}
          latestChangesRequestedReview={{
            roundNumber: 3,
            requestReason: "El hero no refleja la propuesta de valor sellada.",
            targetStation: "qa",
          }}
        />
      );
      expect(screen.getByText(/cambios solicitados en la ronda 3/i)).toBeInTheDocument();
      expect(
        screen.getByText(/el hero no refleja la propuesta de valor sellada\./i)
      ).toBeInTheDocument();
      expect(screen.getByText(/destino: qa/i)).toBeInTheDocument();
      const link = screen.getByText(/ir a revisión/i).closest("a");
      expect(link).toHaveAttribute("href", "/proyectos/pixelforge/proj-1/revision");
    });

    it("targetStation null: el destino se lee 'bloqueo técnico'", () => {
      render(
        <ProductionPanel
          projectId="proj-1"
          blueprintSealed={true}
          blueprintSealedAt="2026-07-01T00:00:00.000Z"
          versions={[versionFixture()]}
          latestChangesRequestedReview={{
            roundNumber: 1,
            requestReason: "El bug de overflow persiste en móvil.",
            targetStation: null,
          }}
        />
      );
      expect(screen.getByText(/bloqueo técnico/i)).toBeInTheDocument();
    });
  });
});
