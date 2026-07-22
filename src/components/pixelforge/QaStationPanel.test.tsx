// @vitest-environment jsdom
// src/components/pixelforge/QaStationPanel.test.tsx
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { QaFindingView, QaRunView } from "./QaStationPanel";

// El Select de radix (PF-X1 T3) mide/desplaza el item activo al abrir — jsdom
// no implementa `scrollIntoView` (mismo stub que `NewPixelforgeForm.test.tsx`).
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const { usePixelforgeQaRunMock, refreshMock } = vi.hoisted(() => ({
  usePixelforgeQaRunMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("@/hooks/pixelforge/use-pixelforge-qa-run", () => ({
  usePixelforgeQaRun: usePixelforgeQaRunMock,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { QaStationPanel } from "./QaStationPanel";

/** Por defecto, sin corrida activa ni de comparación rastreada por el hook. */
function defaultHookReturn() {
  return { run: null, findings: [], isLoading: false, error: undefined };
}

function runFixture(overrides: Partial<QaRunView> = {}): QaRunView {
  return {
    id: "run-1",
    pageVersionId: "ver-2",
    pageVersionNumber: 2,
    status: "succeeded",
    progress: 100,
    currentPhase: "cierre",
    verdict: "pass",
    scoreTotal: 92,
    categoryScores: {
      estructura: { score: 95, weight: 20, penalty: 5, findings: 1 },
      diseno: { score: 90, weight: 15, penalty: 10, findings: 1 },
    },
    catalogVersion: "1",
    scoringVersion: "1",
    humanDecision: null,
    humanDecisionByName: null,
    humanDecisionAt: null,
    humanDecisionReason: null,
    error: null,
    createdAt: "2026-07-18T12:00:00.000Z",
    finishedAt: "2026-07-18T12:05:00.000Z",
    ...overrides,
  };
}

function findingFixture(overrides: Partial<QaFindingView> = {}): QaFindingView {
  return {
    id: "f-1",
    checkCode: "QA-VI-002",
    category: "visual",
    severity: "major",
    blocking: false,
    source: "nav",
    title: "Overflow horizontal dentro de una sección",
    description: "La sección 'hero' desborda 12px en móvil.",
    recommendation: "Revisa el contenido de la sección afectada.",
    evidence: { overflowPx: 12 },
    location: { nodeId: "hero-1", viewport: "mobile" },
    locationKey: "QA-VI-002|hero-1|mobile|-",
    ...overrides,
  };
}

describe("QaStationPanel", () => {
  it("gate de entrada: locked sin page_version vigente", () => {
    usePixelforgeQaRunMock.mockReturnValue(defaultHookReturn());
    render(
      <QaStationPanel
        projectId="proj-1"
        currentPageVersion={null}
        initialActiveRunId={null}
        runs={[]}
        currentRunFindings={[]}
        screenshotUrlByAssetId={{}}
      />
    );
    expect(screen.getByText(/todavía no hay metal que templar/i)).toBeInTheDocument();
    expect(screen.getByText(/compón la landing en producción para templar el metal/i)).toBeInTheDocument();
  });

  it.each([
    ["pass" as const, "TEMPLADA"],
    ["pass_with_warnings" as const, "TEMPLADA CON RESERVAS"],
    ["fail" as const, "QUEBRADIZA"],
  ])("cabecera: verdict %s muestra '%s' + score + barras por categoría", (verdict, label) => {
    usePixelforgeQaRunMock.mockReturnValue(defaultHookReturn());
    const run = runFixture({ verdict, scoreTotal: 77 });
    render(
      <QaStationPanel
        projectId="proj-1"
        currentPageVersion={{ id: "ver-2", version: 2 }}
        initialActiveRunId={null}
        runs={[run]}
        currentRunFindings={[]}
        screenshotUrlByAssetId={{}}
      />
    );
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("77")).toBeInTheDocument();
    expect(screen.getByText(/catalog v1/i)).toBeInTheDocument();
    expect(screen.getByText("Estructura")).toBeInTheDocument();
  });

  it("estado forging: progreso por fase usando el hook", () => {
    usePixelforgeQaRunMock.mockReturnValue({
      run: { id: "run-active", status: "running", progress: 42, currentPhase: "navegador" },
      findings: [],
      isLoading: false,
      error: undefined,
    });
    render(
      <QaStationPanel
        projectId="proj-1"
        currentPageVersion={{ id: "ver-2", version: 2 }}
        initialActiveRunId="run-active"
        runs={[]}
        currentRunFindings={[]}
        screenshotUrlByAssetId={{}}
      />
    );
    expect(screen.getByText(/prueba en el banco \(navegador\)/i)).toBeInTheDocument();
  });

  describe("findings", () => {
    const findings = [
      findingFixture({ id: "f-crit", checkCode: "QA-ST-001", severity: "critical", category: "estructura", blocking: true }),
      findingFixture({ id: "f-major", checkCode: "QA-VI-002", severity: "major", category: "visual", blocking: false }),
      findingFixture({ id: "f-info", checkCode: "QA-TE-008", severity: "info", category: "tecnico", blocking: false }),
    ];

    function renderWithFindings() {
      usePixelforgeQaRunMock.mockReturnValue(defaultHookReturn());
      render(
        <QaStationPanel
          projectId="proj-1"
          currentPageVersion={{ id: "ver-2", version: 2 }}
          initialActiveRunId={null}
          runs={[runFixture()]}
          currentRunFindings={findings}
          screenshotUrlByAssetId={{}}
        />
      );
    }

    it("renderiza los 3 findings con su badge bloqueante", () => {
      renderWithFindings();
      expect(screen.getByText("QA-ST-001")).toBeInTheDocument();
      expect(screen.getByText("QA-VI-002")).toBeInTheDocument();
      expect(screen.getByText("QA-TE-008")).toBeInTheDocument();
      expect(screen.getByText("bloqueante")).toBeInTheDocument();
    });

    it("filtra por severidad al des-marcar un chip", () => {
      renderWithFindings();
      fireEvent.click(screen.getByRole("button", { name: "Filtrar severidad Crítico" }));
      expect(screen.queryByText("QA-ST-001")).not.toBeInTheDocument();
      expect(screen.getByText("QA-VI-002")).toBeInTheDocument();
    });

    it("filtra por categoría vía el select", async () => {
      renderWithFindings();
      fireEvent.click(screen.getByRole("combobox", { name: "Categoría" }));
      fireEvent.click(await screen.findByRole("option", { name: "Visual" }));
      expect(screen.queryByText("QA-ST-001")).not.toBeInTheDocument();
      expect(screen.getByText("QA-VI-002")).toBeInTheDocument();
    });

    it("expandible muestra descripción + evidencia", () => {
      renderWithFindings();
      fireEvent.click(screen.getByText("QA-VI-002"));
      expect(screen.getByText(/la sección 'hero' desborda 12px en móvil/i)).toBeInTheDocument();
      expect(screen.getByText(/"overflowPx": 12/)).toBeInTheDocument();
    });
  });

  describe("comparación de versiones", () => {
    const targetRun = runFixture({ id: "run-2", pageVersionId: "ver-2", pageVersionNumber: 2, verdict: "pass", scoreTotal: 90 });
    const olderRun = runFixture({ id: "run-1", pageVersionId: "ver-1", pageVersionNumber: 1, verdict: "pass_with_warnings", scoreTotal: 70 });
    const targetFindings = [findingFixture({ id: "f-new", checkCode: "QA-NEW-001", locationKey: "QA-NEW-001|-|-|-" })];
    const olderFindings = [
      { id: "f-old", checkCode: "QA-OLD-001", locationKey: "QA-OLD-001|-|-|-" },
    ];

    it("calcula delta de score y las 3 listas por checkCode+locationKey", async () => {
      usePixelforgeQaRunMock.mockImplementation((id: string | null) => {
        if (id === "run-1") {
          return {
            run: { id: "run-1", catalogVersion: "1", scoringVersion: "1", scoreTotal: 70, categoryScores: {} },
            findings: olderFindings,
            isLoading: false,
            error: undefined,
          };
        }
        return defaultHookReturn();
      });

      render(
        <QaStationPanel
          projectId="proj-1"
          currentPageVersion={{ id: "ver-2", version: 2 }}
          initialActiveRunId={null}
          runs={[targetRun, olderRun]}
          currentRunFindings={targetFindings}
          screenshotUrlByAssetId={{}}
        />
      );

      fireEvent.click(screen.getByRole("combobox", { name: "Comparar con" }));
      fireEvent.click(await screen.findByRole("option", { name: /v1/i }));

      expect(await screen.findByText(/vs v1/i)).toBeInTheDocument();
      expect(screen.getByText(/▲/)).toBeInTheDocument();
      const nuevos = screen.getByText(/Nuevos \(1\)/i).closest("div")!;
      expect(within(nuevos).getByText("QA-NEW-001")).toBeInTheDocument();
      const resueltos = screen.getByText(/Resueltos \(1\)/i).closest("div")!;
      expect(within(resueltos).getByText("QA-OLD-001")).toBeInTheDocument();
    });

    it("catalog_version distinto → no comparable", async () => {
      usePixelforgeQaRunMock.mockImplementation((id: string | null) => {
        if (id === "run-1") {
          return {
            run: { id: "run-1", catalogVersion: "0", scoringVersion: "1", scoreTotal: 70, categoryScores: {} },
            findings: [],
            isLoading: false,
            error: undefined,
          };
        }
        return defaultHookReturn();
      });

      render(
        <QaStationPanel
          projectId="proj-1"
          currentPageVersion={{ id: "ver-2", version: 2 }}
          initialActiveRunId={null}
          runs={[targetRun, olderRun]}
          currentRunFindings={targetFindings}
          screenshotUrlByAssetId={{}}
        />
      );

      fireEvent.click(screen.getByRole("combobox", { name: "Comparar con" }));
      fireEvent.click(await screen.findByRole("option", { name: /v1/i }));

      expect(await screen.findByText(/no comparable/i)).toBeInTheDocument();
    });
  });

  describe("aprobar con reservas", () => {
    function renderPendingDecision() {
      usePixelforgeQaRunMock.mockReturnValue(defaultHookReturn());
      const run = runFixture({ verdict: "pass_with_warnings", humanDecision: null });
      render(
        <QaStationPanel
          projectId="proj-1"
          currentPageVersion={{ id: "ver-2", version: 2 }}
          initialActiveRunId={null}
          runs={[run]}
          currentRunFindings={[]}
          screenshotUrlByAssetId={{}}
        />
      );
    }

    it("razón < 5 caracteres no habilita enviar", () => {
      renderPendingDecision();
      const textarea = screen.getByPlaceholderText(/explica tu decisión/i);
      fireEvent.change(textarea, { target: { value: "abc" } });
      expect(screen.getByText(/aprobar con reservas/i, { selector: "button" })).toBeDisabled();
    });

    it("envía POST decision al aprobar con razón válida", async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
      renderPendingDecision();
      const textarea = screen.getByPlaceholderText(/explica tu decisión/i);
      fireEvent.change(textarea, { target: { value: "Se aprueba, riesgo aceptable" } });
      fireEvent.click(screen.getByText(/aprobar con reservas/i, { selector: "button" }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
        "/api/pixelforge/qa/runs/run-1/decision",
        expect.objectContaining({ method: "POST" })
      ));
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body).toEqual({ decision: "approved", reason: "Se aprueba, riesgo aceptable" });
      await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    });
  });

  it("banner de temple obsoleto cuando el run vigente-cerrado es de una versión anterior", () => {
    usePixelforgeQaRunMock.mockReturnValue(defaultHookReturn());
    const oldRun = runFixture({ pageVersionId: "ver-1", pageVersionNumber: 1, verdict: "pass" });
    render(
      <QaStationPanel
        projectId="proj-1"
        currentPageVersion={{ id: "ver-2", version: 2 }}
        initialActiveRunId={null}
        runs={[oldRun]}
        currentRunFindings={[]}
        screenshotUrlByAssetId={{}}
      />
    );
    expect(screen.getByText(/este temple corresponde a v1; la vigente es v2/i)).toBeInTheDocument();
  });
});
