// @vitest-environment jsdom
// src/components/pixelforge/VisualDnaPanel.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { VisualDna } from "@/lib/pixelforge/schemas/synthesize-visual-dna";

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

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { VisualDnaPanel } from "./VisualDnaPanel";

function fixtureDna(): VisualDna {
  return {
    direccionGeneral: "Editorial premium con mucho espacio en blanco y tipografía serif en títulos.",
    paleta: {
      estrategia: "Neutros cálidos con un acento terracota para CTAs.",
      contraste: "medio",
    },
    tipografia: {
      caracterTitulos: "Serif editorial con peso alto",
      caracterCuerpo: "Sans-serif geométrica, alta legibilidad",
    },
    espaciado: "aireado",
    motivosVisuales: ["líneas finas", "fotografía documental"],
    antiPatrones: ["gradientes morados genéricos de IA", "iconos 3D flotantes"],
    influencias: [
      { referenceId: "ref-1", peso: "alta", queTomar: "El uso de espacio negativo en el hero" },
    ],
  };
}

describe("VisualDnaPanel", () => {
  beforeEach(() => {
    usePixelforgeRunMock.mockReturnValue({ run: null, isPolling: false, error: undefined });
  });

  it("sin dna y estrategia NO sellada: muestra el aviso y el CTA está disabled", () => {
    render(
      <VisualDnaPanel
        projectId="proj-1"
        artifactStatus="pending"
        dna={null}
        strategySealed={false}
        analyzedReferenceCount={0}
      />
    );
    expect(screen.getByText(/Sella la Estrategia para habilitar el Visual DNA/i)).toBeInTheDocument();
    expect(screen.getByText("Sintetizar Visual DNA").closest("button")).toBeDisabled();
  });

  it("estrategia sellada pero 0 referencias analizadas: aviso distinto y CTA disabled", () => {
    render(
      <VisualDnaPanel
        projectId="proj-1"
        artifactStatus="pending"
        dna={null}
        strategySealed={true}
        analyzedReferenceCount={0}
      />
    );
    expect(
      screen.getByText(/Analiza al menos una referencia antes de sintetizar/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Sintetizar Visual DNA").closest("button")).toBeDisabled();
  });

  it("estrategia sellada y >=1 referencia analizada: el CTA está habilitado", () => {
    render(
      <VisualDnaPanel
        projectId="proj-1"
        artifactStatus="pending"
        dna={null}
        strategySealed={true}
        analyzedReferenceCount={1}
      />
    );
    expect(screen.getByText("Sintetizar Visual DNA").closest("button")).toBeEnabled();
  });

  it("con dna: renderiza todas las secciones desde el fixture", () => {
    render(
      <VisualDnaPanel
        projectId="proj-1"
        artifactStatus="in_progress"
        dna={fixtureDna()}
        strategySealed={true}
        analyzedReferenceCount={1}
        references={[{ id: "ref-1", label: "Sitio inspirador" }]}
      />
    );

    expect(screen.getByText("Dirección general")).toBeInTheDocument();
    expect(
      screen.getByText(/Editorial premium con mucho espacio en blanco/)
    ).toBeInTheDocument();

    expect(screen.getByText("Paleta")).toBeInTheDocument();
    expect(screen.getByText(/Neutros cálidos con un acento terracota/)).toBeInTheDocument();
    expect(screen.getByText("Contraste medio")).toBeInTheDocument();

    expect(screen.getByText("Tipografía")).toBeInTheDocument();
    expect(screen.getByText("Serif editorial con peso alto")).toBeInTheDocument();
    expect(screen.getByText("Sans-serif geométrica, alta legibilidad")).toBeInTheDocument();

    expect(screen.getByText("Espaciado")).toBeInTheDocument();
    expect(screen.getByText("Aireado")).toBeInTheDocument();

    expect(screen.getByText("Motivos visuales")).toBeInTheDocument();
    expect(screen.getByText("líneas finas")).toBeInTheDocument();
    expect(screen.getByText("fotografía documental")).toBeInTheDocument();

    expect(screen.getByText("Anti-patrones (evitar)")).toBeInTheDocument();
    expect(screen.getByText("gradientes morados genéricos de IA")).toBeInTheDocument();

    expect(screen.getByText("Influencias")).toBeInTheDocument();
    expect(screen.getByText("Sitio inspirador")).toBeInTheDocument();
    expect(screen.getByText("Peso alto")).toBeInTheDocument();
    expect(screen.getByText("El uso de espacio negativo en el hero")).toBeInTheDocument();
  });

  it("influencias: sin lookup de referencias, cae al referenceId crudo", () => {
    render(
      <VisualDnaPanel
        projectId="proj-1"
        artifactStatus="in_progress"
        dna={fixtureDna()}
        strategySealed={true}
        analyzedReferenceCount={1}
      />
    );
    expect(screen.getByText("ref-1")).toBeInTheDocument();
  });

  it("editar dirección general: guarda llamando la action con el dna COMPLETO y kind visual_dna", async () => {
    updateArtifactDraftActionMock.mockResolvedValue({ success: true });
    const dna = fixtureDna();
    render(
      <VisualDnaPanel
        projectId="proj-1"
        artifactStatus="in_progress"
        dna={dna}
        strategySealed={true}
        analyzedReferenceCount={1}
      />
    );

    fireEvent.click(screen.getByLabelText(/Editar dirección general/i));
    const textarea = screen.getByDisplayValue(dna.direccionGeneral);
    fireEvent.change(textarea, { target: { value: "Nueva dirección editada." } });
    fireEvent.click(screen.getByText("Guardar"));

    await waitFor(() => expect(updateArtifactDraftActionMock).toHaveBeenCalled());
    const call = updateArtifactDraftActionMock.mock.calls[0][0];
    expect(call.projectId).toBe("proj-1");
    expect(call.kind).toBe("visual_dna");
    expect(call.draft.direccionGeneral).toBe("Nueva dirección editada.");
    // El resto del dna se conserva íntegro (clon completo, no un parche).
    expect(call.draft.paleta).toEqual(dna.paleta);
    expect(call.draft.tipografia).toEqual(dna.tipografia);
    expect(call.draft.motivosVisuales).toEqual(dna.motivosVisuales);
    expect(call.draft.antiPatrones).toEqual(dna.antiPatrones);
    expect(call.draft.influencias).toEqual(dna.influencias);
  });

  it("status sealed: no muestra el botón de editar", () => {
    render(
      <VisualDnaPanel
        projectId="proj-1"
        artifactStatus="sealed"
        dna={fixtureDna()}
        strategySealed={true}
        analyzedReferenceCount={1}
      />
    );
    expect(screen.queryByLabelText(/editar/i)).not.toBeInTheDocument();
  });

  it("status invalidated: muestra el banner de invalidación", () => {
    render(
      <VisualDnaPanel
        projectId="proj-1"
        artifactStatus="invalidated"
        dna={fixtureDna()}
        strategySealed={true}
        analyzedReferenceCount={1}
      />
    );
    expect(
      screen.getByText(/quedó invalidado por reapertura de una estación anterior/i)
    ).toBeInTheDocument();
  });

  it("sintetizar: hace POST a /api/pixelforge/runs con operation synthesize_visual_dna", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ runId: "run-1", status: "running" }),
    });
    render(
      <VisualDnaPanel
        projectId="proj-1"
        artifactStatus="pending"
        dna={null}
        strategySealed={true}
        analyzedReferenceCount={1}
      />
    );

    fireEvent.click(screen.getByText("Sintetizar Visual DNA"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/pixelforge/runs");
    expect(JSON.parse(init.body)).toEqual({ projectId: "proj-1", operation: "synthesize_visual_dna" });
  });

  it("status sealed con sealedAt: muestra la ForgeStamp y la plancha usa el estado sealed (PF-X1 T6)", () => {
    const { container } = render(
      <VisualDnaPanel
        projectId="proj-1"
        artifactStatus="sealed"
        dna={fixtureDna()}
        strategySealed={true}
        analyzedReferenceCount={1}
        sealedAt="2026-07-18"
      />
    );
    expect(screen.getByText("SELLADO · 18 jul 2026")).toBeInTheDocument();
    expect(container.querySelector(".forge-zone--sealed")).not.toBeNull();
  });

  it("gate no cumplido (sin dna): el estado vacío usa la materialidad locked", () => {
    const { container } = render(
      <VisualDnaPanel
        projectId="proj-1"
        artifactStatus="pending"
        dna={null}
        strategySealed={false}
        analyzedReferenceCount={0}
      />
    );
    expect(container.querySelector(".forge-zone--locked")).not.toBeNull();
  });

  it("hay lastRunId y status !== sealed: muestra botones de decisión; tras click, muestra agradecimiento", async () => {
    setRunDecisionActionMock.mockResolvedValue({ success: true });
    render(
      <VisualDnaPanel
        projectId="proj-1"
        artifactStatus="in_progress"
        dna={fixtureDna()}
        strategySealed={true}
        analyzedReferenceCount={1}
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
