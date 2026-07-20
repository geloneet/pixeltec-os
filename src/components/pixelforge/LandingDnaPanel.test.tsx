// @vitest-environment jsdom
// src/components/pixelforge/LandingDnaPanel.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { LandingDna } from "@/lib/pixelforge/schemas/generate-strategy";

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

// Evita depender de fetch real para el flujo de "Generar estrategia".
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { LandingDnaPanel } from "./LandingDnaPanel";

function fixtureDna(): LandingDna {
  return {
    propuestaValor: "La remodeladora que entrega a tiempo y sin sorpresas en el presupuesto.",
    audiencia: {
      descripcion: "Dueños de casa en zonas residenciales que ya cotizaron y se quedaron con dudas.",
      dolores: ["Miedo a que el proyecto se alargue más de lo prometido"],
      objeciones: ["¿Y si el presupuesto final no es el que me dijeron?"],
    },
    tono: {
      voz: "Cercano y directo, sin tecnicismos de construcción.",
      atributos: ["confiable", "claro"],
    },
    mensajesClave: [
      {
        mensaje: "Entregamos en el plazo pactado o no cobramos el excedente.",
        evidencias: [{ sourceRef: "brief", cita: "garantía de plazo pactado" }],
      },
    ],
    llamadosAccion: [{ texto: "Cotiza tu remodelación", intencion: "cotizacion" }],
    evidencias: [{ sourceRef: "braindump", cita: "hacemos remodelaciones de casas" }],
  };
}

describe("LandingDnaPanel", () => {
  beforeEach(() => {
    usePixelforgeRunMock.mockReturnValue({ run: null, isPolling: false, error: undefined });
  });

  it("sin dna y contexto NO sellado: muestra el aviso y el CTA está disabled", () => {
    render(
      <LandingDnaPanel
        projectId="proj-1"
        artifactStatus="pending"
        dna={null}
        contextSealed={false}
      />
    );
    expect(screen.getByText(/Sella el Contexto para habilitar la estrategia/i)).toBeInTheDocument();
    expect(screen.getByText("Generar estrategia").closest("button")).toBeDisabled();
  });

  it("sin dna y contexto sellado: el CTA 'Generar estrategia' está habilitado", () => {
    render(
      <LandingDnaPanel
        projectId="proj-1"
        artifactStatus="pending"
        dna={null}
        contextSealed={true}
      />
    );
    expect(screen.getByText("Generar estrategia").closest("button")).toBeEnabled();
  });

  it("con dna: renderiza todas las secciones desde el fixture", () => {
    render(
      <LandingDnaPanel
        projectId="proj-1"
        artifactStatus="in_progress"
        dna={fixtureDna()}
        contextSealed={true}
      />
    );

    expect(screen.getByText("Propuesta de valor")).toBeInTheDocument();
    expect(
      screen.getByText("La remodeladora que entrega a tiempo y sin sorpresas en el presupuesto.")
    ).toBeInTheDocument();

    expect(screen.getByText("Audiencia")).toBeInTheDocument();
    expect(
      screen.getByText(/Dueños de casa en zonas residenciales/)
    ).toBeInTheDocument();
    expect(screen.getByText("Miedo a que el proyecto se alargue más de lo prometido")).toBeInTheDocument();
    expect(screen.getByText("¿Y si el presupuesto final no es el que me dijeron?")).toBeInTheDocument();

    expect(screen.getByText("Tono")).toBeInTheDocument();
    expect(screen.getByText("Cercano y directo, sin tecnicismos de construcción.")).toBeInTheDocument();
    expect(screen.getByText("confiable")).toBeInTheDocument();
    expect(screen.getByText("claro")).toBeInTheDocument();

    expect(screen.getByText("Mensajes clave")).toBeInTheDocument();
    expect(
      screen.getByText("Entregamos en el plazo pactado o no cobramos el excedente.")
    ).toBeInTheDocument();

    expect(screen.getByText("Llamados a acción")).toBeInTheDocument();
    expect(screen.getByText("Cotiza tu remodelación")).toBeInTheDocument();
    expect(screen.getByText("Cotización")).toBeInTheDocument();

    expect(screen.getByText(/Evidencias globales/)).toBeInTheDocument();
  });

  it("editar propuesta de valor: guarda llamando la action con el dna COMPLETO y el kind correcto", async () => {
    updateArtifactDraftActionMock.mockResolvedValue({ success: true });
    const dna = fixtureDna();
    render(
      <LandingDnaPanel
        projectId="proj-1"
        artifactStatus="in_progress"
        dna={dna}
        contextSealed={true}
      />
    );

    fireEvent.click(screen.getByLabelText(/Editar propuesta de valor/i));
    const textarea = screen.getByDisplayValue(dna.propuestaValor);
    fireEvent.change(textarea, { target: { value: "Nueva propuesta de valor editada." } });
    fireEvent.click(screen.getByText("Guardar"));

    await waitFor(() => expect(updateArtifactDraftActionMock).toHaveBeenCalled());
    const call = updateArtifactDraftActionMock.mock.calls[0][0];
    expect(call.projectId).toBe("proj-1");
    expect(call.kind).toBe("landing_dna");
    expect(call.draft.propuestaValor).toBe("Nueva propuesta de valor editada.");
    // El resto del dna se conserva íntegro (clon completo, no un parche).
    expect(call.draft.audiencia).toEqual(dna.audiencia);
    expect(call.draft.tono).toEqual(dna.tono);
    expect(call.draft.mensajesClave).toEqual(dna.mensajesClave);
    expect(call.draft.llamadosAccion).toEqual(dna.llamadosAccion);
    expect(call.draft.evidencias).toEqual(dna.evidencias);
  });

  it("editar un mensaje clave: guarda solo ese mensaje modificado dentro del dna completo", async () => {
    updateArtifactDraftActionMock.mockResolvedValue({ success: true });
    const dna = fixtureDna();
    render(
      <LandingDnaPanel
        projectId="proj-1"
        artifactStatus="in_progress"
        dna={dna}
        contextSealed={true}
      />
    );

    fireEvent.click(screen.getByLabelText(/Editar mensaje clave 1/i));
    const textarea = screen.getByDisplayValue(dna.mensajesClave[0].mensaje);
    fireEvent.change(textarea, { target: { value: "Mensaje clave editado." } });
    fireEvent.click(screen.getByText("Guardar"));

    await waitFor(() => expect(updateArtifactDraftActionMock).toHaveBeenCalled());
    const call = updateArtifactDraftActionMock.mock.calls[0][0];
    expect(call.draft.mensajesClave[0].mensaje).toBe("Mensaje clave editado.");
    expect(call.draft.mensajesClave[0].evidencias).toEqual(dna.mensajesClave[0].evidencias);
    expect(call.draft.propuestaValor).toBe(dna.propuestaValor);
  });

  it("status sealed: no muestra botones de editar", () => {
    render(
      <LandingDnaPanel
        projectId="proj-1"
        artifactStatus="sealed"
        dna={fixtureDna()}
        contextSealed={true}
      />
    );
    expect(screen.queryByLabelText(/editar/i)).not.toBeInTheDocument();
  });

  it("status invalidated: muestra el banner de invalidación", () => {
    render(
      <LandingDnaPanel
        projectId="proj-1"
        artifactStatus="invalidated"
        dna={fixtureDna()}
        contextSealed={true}
      />
    );
    expect(
      screen.getByText(/quedó invalidado por la reapertura del Contexto/i)
    ).toBeInTheDocument();
  });

  it("hay lastRunId y status !== sealed: muestra botones de decisión; tras click, muestra agradecimiento", async () => {
    setRunDecisionActionMock.mockResolvedValue({ success: true });
    render(
      <LandingDnaPanel
        projectId="proj-1"
        artifactStatus="in_progress"
        dna={fixtureDna()}
        contextSealed={true}
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

  it("status sealed con sealedAt: muestra la ForgeStamp y la plancha usa el estado sealed (PF-X2 T2)", () => {
    const { container } = render(
      <LandingDnaPanel
        projectId="proj-1"
        artifactStatus="sealed"
        dna={fixtureDna()}
        contextSealed={true}
        sealedAt="2026-07-18"
      />
    );
    expect(screen.getByText("SELLADO · 18 jul 2026")).toBeInTheDocument();
    expect(container.querySelector(".forge-zone--sealed")).not.toBeNull();
  });

  it("gate no cumplido (sin dna, contexto no sellado): el estado vacío usa la materialidad locked", () => {
    const { container } = render(
      <LandingDnaPanel
        projectId="proj-1"
        artifactStatus="pending"
        dna={null}
        contextSealed={false}
      />
    );
    expect(container.querySelector(".forge-zone--locked")).not.toBeNull();
  });
});
