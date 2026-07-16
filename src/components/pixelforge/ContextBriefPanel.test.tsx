// @vitest-environment jsdom
// src/components/pixelforge/ContextBriefPanel.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ContextBrief } from "@/lib/pixelforge/schemas/analyze-context";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const {
  updateArtifactDraftActionMock,
  setRunDecisionActionMock,
  refreshMock,
  usePixelforgeRunMock,
} = vi.hoisted(() => ({
  updateArtifactDraftActionMock: vi.fn(),
  setRunDecisionActionMock: vi.fn(),
  refreshMock: vi.fn(),
  usePixelforgeRunMock: vi.fn(),
}));

vi.mock("@/app/(admin)/proyectos/pixelforge/actions", () => ({
  updateArtifactDraftAction: updateArtifactDraftActionMock,
  setRunDecisionAction: setRunDecisionActionMock,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));
vi.mock("@/hooks/pixelforge/use-pixelforge-run", () => ({
  usePixelforgeRun: usePixelforgeRunMock,
}));

// Evita depender de fetch real para el flujo de "Analizar contexto".
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { ContextBriefPanel } from "./ContextBriefPanel";

function fixtureBrief(): ContextBrief {
  return {
    resumen: "Landing para una constructora de remodelaciones residenciales.",
    confirmados: [
      {
        titulo: "Rubro",
        detalle: "Remodelaciones residenciales.",
        confianza: "alta",
        evidencias: [{ sourceRef: "braindump", cita: "hacemos remodelaciones de casas" }],
      },
    ],
    inferidos: [
      {
        titulo: "Ticket promedio",
        detalle: "Posiblemente gama media.",
        confianza: "baja",
        evidencias: [],
      },
    ],
    faltantes: [
      {
        titulo: "Zona de cobertura",
        detalle: "No se menciona en qué ciudades opera.",
        confianza: "media",
        evidencias: [],
      },
    ],
    contradicciones: [],
  };
}

describe("ContextBriefPanel", () => {
  beforeEach(() => {
    usePixelforgeRunMock.mockReturnValue({ run: null, isPolling: false, error: undefined });
  });

  it("sin brief: muestra el CTA 'Analizar contexto'", () => {
    render(
      <ContextBriefPanel projectId="proj-1" artifactStatus="pending" brief={null} />
    );
    expect(screen.getByText("Analizar contexto")).toBeInTheDocument();
  });

  it("con brief: renderiza las 4 columnas con sus ítems y badges de confianza", () => {
    render(
      <ContextBriefPanel projectId="proj-1" artifactStatus="in_progress" brief={fixtureBrief()} />
    );
    expect(screen.getByText("Confirmados")).toBeInTheDocument();
    expect(screen.getByText("Inferidos")).toBeInTheDocument();
    expect(screen.getByText("Faltantes")).toBeInTheDocument();
    expect(screen.getByText("Contradicciones")).toBeInTheDocument();

    expect(screen.getByText("Rubro")).toBeInTheDocument();
    expect(screen.getByText("Ticket promedio")).toBeInTheDocument();
    expect(screen.getByText("Zona de cobertura")).toBeInTheDocument();

    expect(screen.getByText(/confianza alta/i)).toBeInTheDocument();
    expect(screen.getByText(/confianza baja/i)).toBeInTheDocument();
    expect(screen.getByText(/confianza media/i)).toBeInTheDocument();
  });

  it("editar detalle: guarda llamando la action con el brief COMPLETO y el detalle modificado", async () => {
    updateArtifactDraftActionMock.mockResolvedValue({ success: true });
    const brief = fixtureBrief();
    render(<ContextBriefPanel projectId="proj-1" artifactStatus="in_progress" brief={brief} />);

    const editButtons = screen.getAllByLabelText(/editar/i);
    fireEvent.click(editButtons[0]);

    const textarea = screen.getByDisplayValue("Remodelaciones residenciales.");
    fireEvent.change(textarea, { target: { value: "Remodelaciones residenciales y comerciales." } });
    fireEvent.click(screen.getByText("Guardar"));

    await waitFor(() => expect(updateArtifactDraftActionMock).toHaveBeenCalled());
    const call = updateArtifactDraftActionMock.mock.calls[0][0];
    expect(call.projectId).toBe("proj-1");
    expect(call.kind).toBe("context_brief");
    expect(call.draft.confirmados[0].detalle).toBe("Remodelaciones residenciales y comerciales.");
    // El resto del brief se conserva íntegro (clon completo, no un parche).
    expect(call.draft.inferidos).toEqual(brief.inferidos);
    expect(call.draft.faltantes).toEqual(brief.faltantes);
    expect(call.draft.resumen).toBe(brief.resumen);
  });

  it("descartar item: quita el ítem del array correspondiente en el payload", async () => {
    updateArtifactDraftActionMock.mockResolvedValue({ success: true });
    const brief = fixtureBrief();
    render(<ContextBriefPanel projectId="proj-1" artifactStatus="in_progress" brief={brief} />);

    const discardButtons = screen.getAllByLabelText(/descartar/i);
    // El primer botón de descartar corresponde al único ítem de "confirmados".
    fireEvent.click(discardButtons[0]);

    await waitFor(() => expect(updateArtifactDraftActionMock).toHaveBeenCalled());
    const call = updateArtifactDraftActionMock.mock.calls[0][0];
    expect(call.draft.confirmados).toEqual([]);
    expect(call.draft.inferidos).toEqual(brief.inferidos);
  });

  it("status sealed: no muestra botones de editar ni descartar", () => {
    render(
      <ContextBriefPanel
        projectId="proj-1"
        artifactStatus="sealed"
        brief={fixtureBrief()}
        sealedInfo={{ byName: "Miguel Robles", at: new Date().toISOString() }}
      />
    );
    expect(screen.queryByLabelText(/editar/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/descartar/i)).not.toBeInTheDocument();
  });

  it("status invalidated: muestra el banner de invalidación", () => {
    render(
      <ContextBriefPanel projectId="proj-1" artifactStatus="invalidated" brief={fixtureBrief()} />
    );
    expect(screen.getByText(/quedó invalidado por la reapertura/i)).toBeInTheDocument();
  });

  it("hay lastRunId y status !== sealed: muestra botones de decisión; tras click, muestra agradecimiento", async () => {
    setRunDecisionActionMock.mockResolvedValue({ success: true });
    render(
      <ContextBriefPanel
        projectId="proj-1"
        artifactStatus="in_progress"
        brief={fixtureBrief()}
        lastRunId="run-1"
      />
    );

    expect(screen.getByText("Útil")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Útil"));

    await waitFor(() =>
      expect(setRunDecisionActionMock).toHaveBeenCalledWith({ runId: "run-1", decision: "accepted" })
    );
    await screen.findByText(/gracias por el feedback/i);
  });
});
