// @vitest-environment jsdom
// src/components/pixelforge/SealBar.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const { sealArtifactByKindActionMock, reopenArtifactByKindActionMock, refreshMock } = vi.hoisted(() => ({
  sealArtifactByKindActionMock: vi.fn(),
  reopenArtifactByKindActionMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("@/app/(admin)/proyectos/pixelforge/actions", () => ({
  sealArtifactByKindAction: sealArtifactByKindActionMock,
  reopenArtifactByKindAction: reopenArtifactByKindActionMock,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { SealBar } from "./SealBar";

describe("SealBar", () => {
  it("canSeal false: el botón de sellar está disabled", () => {
    render(
      <SealBar
        projectId="proj-1"
        artifactStatus="pending"
        kind="context_brief"
        kindLabel="Context Brief"
        canSeal={false}
      />
    );
    expect(screen.getByText("Sellar Context Brief").closest("button")).toBeDisabled();
  });

  it("canSeal true: sellar llama a la action genérica con el kind correcto, muestra toast y refresca", async () => {
    sealArtifactByKindActionMock.mockResolvedValue({ success: true });
    render(
      <SealBar
        projectId="proj-1"
        artifactStatus="in_progress"
        kind="context_brief"
        kindLabel="Context Brief"
        canSeal={true}
      />
    );

    fireEvent.click(screen.getByText("Sellar Context Brief"));
    fireEvent.click(await screen.findByText("Confirmar sello"));

    await screen.findByText("Sellar Context Brief");
    expect(sealArtifactByKindActionMock).toHaveBeenCalledWith({
      projectId: "proj-1",
      kind: "context_brief",
    });
    expect(refreshMock).toHaveBeenCalled();
  });

  it("kind landing_dna: usa los textos y llama la action con ese kind", async () => {
    sealArtifactByKindActionMock.mockResolvedValue({ success: true });
    render(
      <SealBar
        projectId="proj-1"
        artifactStatus="in_progress"
        kind="landing_dna"
        kindLabel="Landing DNA"
        canSeal={true}
      />
    );

    expect(screen.getByText("Sellar Landing DNA")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Sellar Landing DNA"));
    fireEvent.click(await screen.findByText("Confirmar sello"));

    await waitFor(() =>
      expect(sealArtifactByKindActionMock).toHaveBeenCalledWith({
        projectId: "proj-1",
        kind: "landing_dna",
      })
    );
  });

  it("sellado: muestra el nombre de quien selló", () => {
    render(
      <SealBar
        projectId="proj-1"
        artifactStatus="sealed"
        kind="context_brief"
        kindLabel="Context Brief"
        canSeal={false}
        sealedByName="Miguel Robles"
        sealedAt={new Date().toISOString()}
      />
    );
    expect(screen.getByText(/Sellado por Miguel Robles/)).toBeInTheDocument();
  });

  it("sellado: la plancha usa materialidad sealed y muestra la ForgeStamp (PF-X1 T6)", () => {
    const { container } = render(
      <SealBar
        projectId="proj-1"
        artifactStatus="sealed"
        kind="context_brief"
        kindLabel="Context Brief"
        canSeal={false}
        sealedByName="Miguel Robles"
        sealedAt="2026-07-18"
      />
    );
    expect(container.querySelector(".forge-zone--sealed")).not.toBeNull();
    expect(screen.getByText("SELLADO · 18 jul 2026")).toBeInTheDocument();
  });

  it("sin sellar: la plancha usa materialidad draft (sin ForgeStamp)", () => {
    const { container } = render(
      <SealBar
        projectId="proj-1"
        artifactStatus="pending"
        kind="context_brief"
        kindLabel="Context Brief"
        canSeal={false}
      />
    );
    expect(container.querySelector(".forge-zone--draft")).not.toBeNull();
    expect(screen.queryByText(/SELLADO ·/)).not.toBeInTheDocument();
  });

  it("reabrir exige razón: sin texto, el botón de confirmar está disabled y la action no se llama", async () => {
    render(
      <SealBar
        projectId="proj-1"
        artifactStatus="sealed"
        kind="context_brief"
        kindLabel="Context Brief"
        canSeal={false}
        sealedByName="Miguel Robles"
        sealedAt={new Date().toISOString()}
        downstreamWarning
      />
    );

    fireEvent.click(screen.getByText("Reabrir"));
    const confirmBtn = await screen.findByText("Confirmar reapertura");
    expect(confirmBtn.closest("button")).toBeDisabled();

    fireEvent.click(confirmBtn);
    expect(reopenArtifactByKindActionMock).not.toHaveBeenCalled();
    expect(
      screen.getByText("Reabrir invalidará los artefactos posteriores sellados.")
    ).toBeInTheDocument();
  });

  it("reabrir con razón válida: llama a la action genérica con kind y razón, y refresca", async () => {
    reopenArtifactByKindActionMock.mockResolvedValue({ success: true });
    render(
      <SealBar
        projectId="proj-1"
        artifactStatus="sealed"
        kind="landing_dna"
        kindLabel="Landing DNA"
        canSeal={false}
        sealedByName="Miguel Robles"
        sealedAt={new Date().toISOString()}
      />
    );

    fireEvent.click(screen.getByText("Reabrir"));
    const textarea = await screen.findByPlaceholderText(/Explica por qué reabres/i);
    fireEvent.change(textarea, { target: { value: "Faltó información clave" } });
    fireEvent.click(screen.getByText("Confirmar reapertura"));

    await waitFor(() => expect(reopenArtifactByKindActionMock).toHaveBeenCalledWith({
      projectId: "proj-1",
      kind: "landing_dna",
      reason: "Faltó información clave",
    }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    // El componente en sí no cambia artifactStatus (lo controla el parent vía
    // props tras el router.refresh); vuelve a la vista "sellado" sin el
    // formulario de reapertura abierto.
    expect(screen.queryByPlaceholderText(/Explica por qué reabres/i)).not.toBeInTheDocument();
  });
});
