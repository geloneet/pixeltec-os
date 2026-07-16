// @vitest-environment jsdom
// src/components/pixelforge/DirectionsPanel.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DirectionCardView } from "./DirectionCard";
import type { DirectionDecision } from "@/lib/pixelforge/schemas/direction-decision";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const {
  chooseDirectionActionMock,
  setRunDecisionActionMock,
  refreshMock,
  usePixelforgeRunMock,
} = vi.hoisted(() => ({
  chooseDirectionActionMock: vi.fn(),
  setRunDecisionActionMock: vi.fn(),
  refreshMock: vi.fn(),
  usePixelforgeRunMock: vi.fn(),
}));

vi.mock("@/app/(admin)/proyectos/pixelforge/actions", () => ({
  chooseDirectionAction: chooseDirectionActionMock,
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

import { DirectionsPanel } from "./DirectionsPanel";

function directionFixture(overrides: Partial<DirectionCardView> = {}): DirectionCardView {
  return {
    id: overrides.id ?? "dir-1",
    slot: overrides.slot ?? 1,
    title: overrides.title ?? "Dirección A",
    concept: "Concepto de la dirección.",
    designTokens: {
      paleta: [
        { token: "color-primario", valor: "#0F172A", uso: "Fondos." },
        { token: "color-fondo", valor: "#FFFFFF", uso: "Fondo general." },
        { token: "color-acento", valor: "#F59E0B", uso: "CTAs." },
      ],
      tipografia: { display: "Fraunces", body: "Inter", escala: "Modular 1.25" },
      radios: "suaves",
      espaciado: "equilibrado",
    },
    motionDna: {
      personalidad: "Preciso",
      ritmo: "moderado",
      intensidadGlobal: 2,
      firmas: ["Entradas escalonadas"],
    },
    signatureMotif: {
      nombre: "Motif genérico",
      descripcion: "Descripción del motif.",
      aplicaciones: ["hero", "footer"],
    },
    signatureComponent: {
      status: "custom-development-required",
      concept: "Concepto custom.",
      businessValue: "Valor de negocio.",
      requiredData: ["dato"],
      estimatedComplexity: "low",
    },
    scores: {
      originalidadConceptual: 60,
      independenciaDeReferencias: 60,
      especificidadDelMotif: 60,
      utilidadDelSignature: 60,
      riesgoGenericidadIA: 20,
      scoresRazones: { porCriterio: "Razón genérica." },
      risks: ["Riesgo A", "Riesgo B"],
    },
    scoreTotal: overrides.scoreTotal ?? 60,
    status: "candidate",
    ...overrides,
  };
}

function baseDraft(overrides: Partial<DirectionDecision> = {}): DirectionDecision {
  return {
    chosenDirectionId: "dir-1",
    rationale: "Se conecta mejor con la audiencia local sin verse genérica.",
    acceptedRisks: ["Riesgo A"],
    combinedFromDirectionIds: [],
    ...overrides,
  };
}

describe("DirectionsPanel", () => {
  it("sin direcciones y visual NO sellado: CTA deshabilitado con hint", () => {
    usePixelforgeRunMock.mockReturnValue({ run: null, isPolling: false, error: undefined });
    render(
      <DirectionsPanel
        projectId="proj-1"
        artifactStatus="pending"
        visualSealed={false}
        directions={[]}
        capabilityNames={{}}
        draft={null}
      />
    );
    expect(screen.getByText("Generar 3 direcciones").closest("button")).toBeDisabled();
  });

  it("sin direcciones y visual sellado: CTA habilitado; click hace POST con operation generate_directions", async () => {
    usePixelforgeRunMock.mockReturnValue({ run: null, isPolling: false, error: undefined });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ runId: "run-1", status: "running" }) });
    render(
      <DirectionsPanel
        projectId="proj-1"
        artifactStatus="pending"
        visualSealed={true}
        directions={[]}
        capabilityNames={{}}
        draft={null}
      />
    );
    const button = screen.getByText("Generar 3 direcciones").closest("button")!;
    expect(button).toBeEnabled();
    fireEvent.click(button);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/pixelforge/runs");
    expect(JSON.parse(init.body)).toEqual({ projectId: "proj-1", operation: "generate_directions" });
  });

  it("con 3 direcciones: renderiza el grid ordenado por scoreTotal desc y la leyenda", () => {
    usePixelforgeRunMock.mockReturnValue({ run: null, isPolling: false, error: undefined });
    const directions = [
      directionFixture({ id: "dir-1", slot: 1, title: "Baja", scoreTotal: 40 }),
      directionFixture({ id: "dir-2", slot: 2, title: "Alta", scoreTotal: 90 }),
      directionFixture({ id: "dir-3", slot: 3, title: "Media", scoreTotal: 65 }),
    ];
    render(
      <DirectionsPanel
        projectId="proj-1"
        artifactStatus="pending"
        visualSealed={true}
        directions={directions}
        capabilityNames={{}}
        draft={null}
      />
    );
    expect(screen.getByText(/El score ordena y alerta — la elección es tuya/i)).toBeInTheDocument();
    // Las cards (DirectionCard) renderizan el título como <h3> — la fila
    // comparativa lo repite en un <th>, así que se acota a los headings para
    // verificar el orden del GRID sin ambigüedad.
    const titles = screen.getAllByRole("heading", { level: 3 }).map((el) => el.textContent);
    expect(titles).toEqual(["Alta", "Media", "Baja"]);
  });

  it("elección obsoleta: banner visible cuando chosenDirectionId del draft ya no está chosen", () => {
    usePixelforgeRunMock.mockReturnValue({ run: null, isPolling: false, error: undefined });
    const directions = [
      directionFixture({ id: "dir-1", slot: 1, status: "candidate" }),
      directionFixture({ id: "dir-2", slot: 2, status: "candidate" }),
      directionFixture({ id: "dir-3", slot: 3, status: "candidate" }),
    ];
    render(
      <DirectionsPanel
        projectId="proj-1"
        artifactStatus="in_progress"
        visualSealed={true}
        directions={directions}
        capabilityNames={{}}
        draft={baseDraft({ chosenDirectionId: "dir-1" })}
      />
    );
    expect(screen.getByText(/Elección obsoleta/i)).toBeInTheDocument();
  });

  it("sin elección obsoleta: no muestra el banner cuando el draft coincide con la dirección chosen vigente", () => {
    usePixelforgeRunMock.mockReturnValue({ run: null, isPolling: false, error: undefined });
    const directions = [
      directionFixture({ id: "dir-1", slot: 1, status: "chosen" }),
      directionFixture({ id: "dir-2", slot: 2, status: "discarded" }),
      directionFixture({ id: "dir-3", slot: 3, status: "discarded" }),
    ];
    render(
      <DirectionsPanel
        projectId="proj-1"
        artifactStatus="in_progress"
        visualSealed={true}
        directions={directions}
        capabilityNames={{}}
        draft={baseDraft({ chosenDirectionId: "dir-1" })}
      />
    );
    expect(screen.queryByText(/Elección obsoleta/i)).not.toBeInTheDocument();
  });

  it("Regenerar slot: tras confirmar, hace POST con projectId/operation/slot", async () => {
    usePixelforgeRunMock.mockReturnValue({ run: null, isPolling: false, error: undefined });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ runId: "run-2", status: "running" }) });
    const directions = [
      directionFixture({ id: "dir-1", slot: 1 }),
      directionFixture({ id: "dir-2", slot: 2 }),
      directionFixture({ id: "dir-3", slot: 3 }),
    ];
    render(
      <DirectionsPanel
        projectId="proj-1"
        artifactStatus="pending"
        visualSealed={true}
        directions={directions}
        capabilityNames={{}}
        draft={null}
      />
    );

    const regenButtons = screen.getAllByText("Regenerar");
    fireEvent.click(regenButtons[0]);
    fireEvent.click(screen.getAllByText("Confirmar")[0]);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/pixelforge/runs");
    const body = JSON.parse(init.body);
    expect(body.projectId).toBe("proj-1");
    expect(body.operation).toBe("generate_directions");
    expect(typeof body.slot).toBe("number");
  });

  it("dialog de elección: rationale corto deshabilita Confirmar; con rationale válido llama chooseDirectionAction y refresca", async () => {
    usePixelforgeRunMock.mockReturnValue({ run: null, isPolling: false, error: undefined });
    chooseDirectionActionMock.mockResolvedValue({ success: true });
    const directions = [
      directionFixture({ id: "dir-1", slot: 1, title: "Dirección A" }),
      directionFixture({ id: "dir-2", slot: 2, title: "Dirección B" }),
      directionFixture({ id: "dir-3", slot: 3, title: "Dirección C" }),
    ];
    render(
      <DirectionsPanel
        projectId="proj-1"
        artifactStatus="pending"
        visualSealed={true}
        directions={directions}
        capabilityNames={{}}
        draft={null}
      />
    );

    fireEvent.click(screen.getAllByText("Elegir esta dirección")[0]);

    const textarea = await screen.findByPlaceholderText(/por qué elegiste esta dirección/i);
    const confirmButton = screen.getByText("Confirmar elección").closest("button")!;
    expect(confirmButton).toBeDisabled();

    fireEvent.change(textarea, {
      target: { value: "Conecta mejor con la audiencia local objetivo del cliente." },
    });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);

    await waitFor(() => expect(chooseDirectionActionMock).toHaveBeenCalled());
    const call = chooseDirectionActionMock.mock.calls[0][0];
    expect(call.projectId).toBe("proj-1");
    expect(call.directionId).toBe("dir-1");
    expect(call.rationale).toBe("Conecta mejor con la audiencia local objetivo del cliente.");
    expect(Array.isArray(call.acceptedRisks)).toBe(true);
    expect(Array.isArray(call.combinedFromDirectionIds)).toBe(true);
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("dialog de elección: precarga los riesgos de la dirección como checkboxes marcados; desmarcar uno lo excluye de acceptedRisks", async () => {
    usePixelforgeRunMock.mockReturnValue({ run: null, isPolling: false, error: undefined });
    chooseDirectionActionMock.mockResolvedValue({ success: true });
    const directions = [
      directionFixture({ id: "dir-1", slot: 1, title: "Dirección A" }),
      directionFixture({ id: "dir-2", slot: 2, title: "Dirección B" }),
      directionFixture({ id: "dir-3", slot: 3, title: "Dirección C" }),
    ];
    render(
      <DirectionsPanel
        projectId="proj-1"
        artifactStatus="pending"
        visualSealed={true}
        directions={directions}
        capabilityNames={{}}
        draft={null}
      />
    );

    fireEvent.click(screen.getAllByText("Elegir esta dirección")[0]);

    // La dirección fixture (`dir-1`) tiene `risks: ["Riesgo A", "Riesgo B"]` —
    // ambos deben aparecer como checkboxes YA marcados (precargados).
    const riskACheckbox = await screen.findByRole("checkbox", { name: /Riesgo A/i });
    const riskBCheckbox = screen.getByRole("checkbox", { name: /Riesgo B/i });
    expect(riskACheckbox).toHaveAttribute("data-state", "checked");
    expect(riskBCheckbox).toHaveAttribute("data-state", "checked");

    fireEvent.click(riskBCheckbox);

    const textarea = screen.getByPlaceholderText(/por qué elegiste esta dirección/i);
    fireEvent.change(textarea, {
      target: { value: "Conecta mejor con la audiencia local objetivo del cliente." },
    });
    fireEvent.click(screen.getByText("Confirmar elección"));

    await waitFor(() => expect(chooseDirectionActionMock).toHaveBeenCalled());
    const call = chooseDirectionActionMock.mock.calls[0][0];
    expect(call.acceptedRisks).toContain("Riesgo A");
    expect(call.acceptedRisks).not.toContain("Riesgo B");
  });

  it("dialog de elección: checkbox de 'combinedFromDirectionIds' incluye el id al marcarse", async () => {
    usePixelforgeRunMock.mockReturnValue({ run: null, isPolling: false, error: undefined });
    chooseDirectionActionMock.mockResolvedValue({ success: true });
    const directions = [
      directionFixture({ id: "dir-1", slot: 1, title: "Dirección A" }),
      directionFixture({ id: "dir-2", slot: 2, title: "Dirección B" }),
      directionFixture({ id: "dir-3", slot: 3, title: "Dirección C" }),
    ];
    render(
      <DirectionsPanel
        projectId="proj-1"
        artifactStatus="pending"
        visualSealed={true}
        directions={directions}
        capabilityNames={{}}
        draft={null}
      />
    );

    fireEvent.click(screen.getAllByText("Elegir esta dirección")[0]);

    const combinedCheckbox = await screen.findByRole("checkbox", { name: "Dirección B" });
    fireEvent.click(combinedCheckbox);

    const textarea = screen.getByPlaceholderText(/por qué elegiste esta dirección/i);
    fireEvent.change(textarea, {
      target: { value: "Conecta mejor con la audiencia local objetivo del cliente." },
    });
    fireEvent.click(screen.getByText("Confirmar elección"));

    await waitFor(() => expect(chooseDirectionActionMock).toHaveBeenCalled());
    const call = chooseDirectionActionMock.mock.calls[0][0];
    expect(call.combinedFromDirectionIds).toEqual(["dir-2"]);
  });

  it("corrida fallida: muestra failureMessage y botón Reintentar", async () => {
    usePixelforgeRunMock.mockReturnValue({ run: null, isPolling: false, error: undefined });
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "Sella el ADN Visual antes de generar direcciones" }) });
    render(
      <DirectionsPanel
        projectId="proj-1"
        artifactStatus="pending"
        visualSealed={true}
        directions={[]}
        capabilityNames={{}}
        draft={null}
      />
    );

    fireEvent.click(screen.getByText("Generar 3 direcciones"));

    await screen.findByText(/Sella el ADN Visual antes de generar direcciones/i);
    expect(screen.getByText("Reintentar")).toBeInTheDocument();
  });
});
