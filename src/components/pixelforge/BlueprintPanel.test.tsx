// @vitest-environment jsdom
// src/components/pixelforge/BlueprintPanel.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { NarrativeBlueprint } from "@/lib/pixelforge/schemas/build-narrative";

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

import { BlueprintPanel } from "./BlueprintPanel";

function fixtureBlueprint(): NarrativeBlueprint {
  return {
    historia: "Una marca que despierta a media noche con una idea imposible.",
    actos: [
      { orden: 1, proposito: "Gancho", mensaje: "Algo no cuadra", tension: "Duda inicial", resolucion: "Curiosidad" },
      { orden: 2, proposito: "Desarrollo", mensaje: "La idea toma forma", tension: "Resistencia interna", resolucion: "Claridad" },
      { orden: 3, proposito: "Cierre", mensaje: "La idea cobra vida", tension: "Miedo al cambio", resolucion: "Acción" },
    ],
    cinematicMoments: [
      { actoOrden: 2, descripcion: "Close-up del boceto en la servilleta.", motifConnection: "Ecoa el trazo del signature motif." },
    ],
    notasProduccion: ["Grabar en formato 4:3 para el flashback."],
  };
}

describe("BlueprintPanel", () => {
  beforeEach(() => {
    usePixelforgeRunMock.mockReturnValue({ run: null, isPolling: false, error: undefined });
  });

  it("vacío y decisión NO sellada: muestra el aviso y el CTA está disabled", () => {
    render(
      <BlueprintPanel
        projectId="proj-1"
        artifactStatus="pending"
        blueprint={null}
        decisionSealed={false}
      />
    );
    expect(screen.getByText(/Sella la decisión de dirección primero/i)).toBeInTheDocument();
    expect(screen.getByText("Generar blueprint narrativo").closest("button")).toBeDisabled();
  });

  it("vacío y decisión sellada: el CTA está habilitado", () => {
    render(
      <BlueprintPanel
        projectId="proj-1"
        artifactStatus="pending"
        blueprint={null}
        decisionSealed={true}
      />
    );
    expect(screen.getByText("Generar blueprint narrativo").closest("button")).toBeEnabled();
  });

  it("CTA dispara POST a /api/pixelforge/runs con operation build_narrative", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ runId: "run-1", status: "running" }),
    });
    render(
      <BlueprintPanel
        projectId="proj-1"
        artifactStatus="pending"
        blueprint={null}
        decisionSealed={true}
      />
    );

    fireEvent.click(screen.getByText("Generar blueprint narrativo"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/pixelforge/runs");
    expect(JSON.parse(init.body)).toEqual({ projectId: "proj-1", operation: "build_narrative" });
  });

  it("con blueprint: renderiza historia, actos numerados, momentos cinematográficos y notas", () => {
    render(
      <BlueprintPanel
        projectId="proj-1"
        artifactStatus="in_progress"
        blueprint={fixtureBlueprint()}
        decisionSealed={true}
      />
    );

    expect(screen.getByText(/Una marca que despierta a media noche/)).toBeInTheDocument();
    expect(screen.getByText("Gancho")).toBeInTheDocument();
    expect(screen.getByText("Desarrollo")).toBeInTheDocument();
    expect(screen.getByText("Cierre")).toBeInTheDocument();
    expect(screen.getByText("Close-up del boceto en la servilleta.")).toBeInTheDocument();
    expect(screen.getByText("Acto 2")).toBeInTheDocument();
    expect(screen.getByText("Grabar en formato 4:3 para el flashback.")).toBeInTheDocument();
  });

  it("dirección obsoleta: muestra el aviso de elección obsoleta", () => {
    render(
      <BlueprintPanel
        projectId="proj-1"
        artifactStatus="in_progress"
        blueprint={fixtureBlueprint()}
        decisionSealed={true}
        directionObsolete={true}
      />
    );
    expect(screen.getByText(/La elección quedó obsoleta/i)).toBeInTheDocument();
  });

  it("status invalidated: muestra el banner de invalidación", () => {
    render(
      <BlueprintPanel
        projectId="proj-1"
        artifactStatus="invalidated"
        blueprint={fixtureBlueprint()}
        decisionSealed={true}
      />
    );
    expect(
      screen.getByText(/quedó invalidado por reapertura de una estación anterior/i)
    ).toBeInTheDocument();
  });

  it("extremos: subir deshabilitado en el primer acto, bajar deshabilitado en el último", () => {
    render(
      <BlueprintPanel
        projectId="proj-1"
        artifactStatus="in_progress"
        blueprint={fixtureBlueprint()}
        decisionSealed={true}
      />
    );
    expect(screen.getByLabelText("Subir acto 1")).toBeDisabled();
    expect(screen.getByLabelText("Bajar acto 1")).toBeEnabled();
    expect(screen.getByLabelText("Subir acto 3")).toBeEnabled();
    expect(screen.getByLabelText("Bajar acto 3")).toBeDisabled();
  });

  it("los botones de reorder son <button> nativos (accesibles por teclado)", () => {
    render(
      <BlueprintPanel
        projectId="proj-1"
        artifactStatus="in_progress"
        blueprint={fixtureBlueprint()}
        decisionSealed={true}
      />
    );
    expect(screen.getByLabelText("Bajar acto 1").tagName).toBe("BUTTON");
    expect(screen.getByLabelText("Subir acto 3").tagName).toBe("BUTTON");
  });

  it("bajar acto 1: intercambia posiciones, renumera 1..n y remapea cinematicMoments por contenido", async () => {
    updateArtifactDraftActionMock.mockResolvedValue({ success: true });
    render(
      <BlueprintPanel
        projectId="proj-1"
        artifactStatus="in_progress"
        blueprint={fixtureBlueprint()}
        decisionSealed={true}
      />
    );

    fireEvent.click(screen.getByLabelText("Bajar acto 1"));

    await waitFor(() => expect(updateArtifactDraftActionMock).toHaveBeenCalled());
    const call = updateArtifactDraftActionMock.mock.calls[0][0];
    expect(call.projectId).toBe("proj-1");
    expect(call.kind).toBe("narrative_blueprint");

    const draft = call.draft as NarrativeBlueprint;
    // Consecutivo desde 1 (regla de dominio del superRefine).
    expect(draft.actos.map((a) => a.orden)).toEqual([1, 2, 3]);
    // El acto que era "Desarrollo" (orden 2) ahora es orden 1; "Gancho" (orden 1) ahora es orden 2.
    expect(draft.actos[0].proposito).toBe("Desarrollo");
    expect(draft.actos[1].proposito).toBe("Gancho");
    expect(draft.actos[2].proposito).toBe("Cierre");
    // El momento cinematográfico seguía ligado al acto "Desarrollo" (antes orden 2) —
    // ahora ese acto es orden 1, así que el momento debe remapearse a actoOrden=1.
    expect(draft.cinematicMoments[0].actoOrden).toBe(1);
  });

  it("reordenar mientras se edita OTRO acto: cancela la edición en curso (evita buffer viejo sobre contenido distinto)", async () => {
    updateArtifactDraftActionMock.mockResolvedValue({ success: true });
    render(
      <BlueprintPanel
        projectId="proj-1"
        artifactStatus="in_progress"
        blueprint={fixtureBlueprint()}
        decisionSealed={true}
      />
    );

    fireEvent.click(screen.getByLabelText("Editar acto 1"));
    expect(screen.getByDisplayValue("Gancho")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Subir acto 3"));

    await waitFor(() => expect(updateArtifactDraftActionMock).toHaveBeenCalled());
    // El formulario de edición del acto 1 se cerró (el textarea con el
    // buffer viejo ya no está) y el botón "Editar" vuelve a mostrarse
    // (modo lectura), en vez de quedar un formulario huérfano sobre
    // contenido que ahora pertenece a otro acto.
    expect(screen.queryByDisplayValue("Gancho")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Editar acto 1")).toBeInTheDocument();
  });

  it("editar un campo de un acto: persiste el blueprint completo con solo ese campo cambiado", async () => {
    updateArtifactDraftActionMock.mockResolvedValue({ success: true });
    const blueprint = fixtureBlueprint();
    render(
      <BlueprintPanel
        projectId="proj-1"
        artifactStatus="in_progress"
        blueprint={blueprint}
        decisionSealed={true}
      />
    );

    fireEvent.click(screen.getByLabelText("Editar acto 2"));
    const mensajeTextarea = screen.getByDisplayValue("La idea toma forma");
    fireEvent.change(mensajeTextarea, { target: { value: "La idea toma forma y asusta." } });
    fireEvent.click(screen.getByText("Guardar"));

    await waitFor(() => expect(updateArtifactDraftActionMock).toHaveBeenCalled());
    const call = updateArtifactDraftActionMock.mock.calls[0][0];
    const draft = call.draft as NarrativeBlueprint;
    const acto2 = draft.actos.find((a) => a.orden === 2)!;
    expect(acto2.mensaje).toBe("La idea toma forma y asusta.");
    // El resto del acto y del blueprint se conserva íntegro (clon completo).
    expect(acto2.proposito).toBe("Desarrollo");
    expect(acto2.tension).toBe("Resistencia interna");
    expect(acto2.resolucion).toBe("Claridad");
    expect(draft.actos[0]).toEqual(blueprint.actos[0]);
    expect(draft.notasProduccion).toEqual(blueprint.notasProduccion);
  });

  it("agregar una nota de producción: persiste con la nota nueva al final del arreglo", async () => {
    updateArtifactDraftActionMock.mockResolvedValue({ success: true });
    render(
      <BlueprintPanel
        projectId="proj-1"
        artifactStatus="in_progress"
        blueprint={fixtureBlueprint()}
        decisionSealed={true}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Agregar una nota de producción…"), {
      target: { value: "Reservar dron para la toma aérea." },
    });
    fireEvent.click(screen.getByText("Agregar"));

    await waitFor(() => expect(updateArtifactDraftActionMock).toHaveBeenCalled());
    const call = updateArtifactDraftActionMock.mock.calls[0][0];
    const draft = call.draft as NarrativeBlueprint;
    expect(draft.notasProduccion).toEqual([
      "Grabar en formato 4:3 para el flashback.",
      "Reservar dron para la toma aérea.",
    ]);
  });

  it("quitar una nota de producción: persiste sin esa nota", async () => {
    updateArtifactDraftActionMock.mockResolvedValue({ success: true });
    render(
      <BlueprintPanel
        projectId="proj-1"
        artifactStatus="in_progress"
        blueprint={fixtureBlueprint()}
        decisionSealed={true}
      />
    );

    fireEvent.click(screen.getByLabelText("Quitar nota 1"));

    await waitFor(() => expect(updateArtifactDraftActionMock).toHaveBeenCalled());
    const call = updateArtifactDraftActionMock.mock.calls[0][0];
    const draft = call.draft as NarrativeBlueprint;
    expect(draft.notasProduccion).toEqual([]);
  });

  it("status sealed: no muestra botones de editar/reordenar/quitar", () => {
    render(
      <BlueprintPanel
        projectId="proj-1"
        artifactStatus="sealed"
        blueprint={fixtureBlueprint()}
        decisionSealed={true}
      />
    );
    expect(screen.queryByLabelText(/editar acto/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/subir acto/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/bajar acto/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/quitar nota/i)).not.toBeInTheDocument();
  });

  it("hay lastRunId y status !== sealed: muestra botones de decisión; tras click, muestra agradecimiento", async () => {
    setRunDecisionActionMock.mockResolvedValue({ success: true });
    render(
      <BlueprintPanel
        projectId="proj-1"
        artifactStatus="in_progress"
        blueprint={fixtureBlueprint()}
        decisionSealed={true}
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
