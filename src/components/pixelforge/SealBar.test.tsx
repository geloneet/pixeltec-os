// @vitest-environment jsdom
// src/components/pixelforge/SealBar.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const { sealContextBriefActionMock, reopenContextBriefActionMock, refreshMock } = vi.hoisted(() => ({
  sealContextBriefActionMock: vi.fn(),
  reopenContextBriefActionMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("@/app/(admin)/proyectos/pixelforge/actions", () => ({
  sealContextBriefAction: sealContextBriefActionMock,
  reopenContextBriefAction: reopenContextBriefActionMock,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { SealBar } from "./SealBar";

describe("SealBar", () => {
  it("canSeal false: el botón de sellar está disabled", () => {
    render(
      <SealBar projectId="proj-1" artifactStatus="pending" canSeal={false} />
    );
    expect(screen.getByText("Sellar Context Brief").closest("button")).toBeDisabled();
  });

  it("canSeal true: sellar llama a la action, muestra toast y refresca", async () => {
    sealContextBriefActionMock.mockResolvedValue({ success: true });
    render(
      <SealBar projectId="proj-1" artifactStatus="in_progress" canSeal={true} />
    );

    fireEvent.click(screen.getByText("Sellar Context Brief"));
    fireEvent.click(await screen.findByText("Confirmar sello"));

    await screen.findByText("Sellar Context Brief");
    expect(sealContextBriefActionMock).toHaveBeenCalledWith({ projectId: "proj-1" });
    expect(refreshMock).toHaveBeenCalled();
  });

  it("sellado: muestra el nombre de quien selló", () => {
    render(
      <SealBar
        projectId="proj-1"
        artifactStatus="sealed"
        canSeal={false}
        sealedByName="Miguel Robles"
        sealedAt={new Date().toISOString()}
      />
    );
    expect(screen.getByText(/Sellado por Miguel Robles/)).toBeInTheDocument();
  });

  it("reabrir exige razón: sin texto, el botón de confirmar está disabled y la action no se llama", async () => {
    render(
      <SealBar
        projectId="proj-1"
        artifactStatus="sealed"
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
    expect(reopenContextBriefActionMock).not.toHaveBeenCalled();
    expect(
      screen.getByText("Reabrir invalidará los artefactos posteriores sellados.")
    ).toBeInTheDocument();
  });

  it("reabrir con razón válida: llama a la action con la razón y refresca", async () => {
    reopenContextBriefActionMock.mockResolvedValue({ success: true });
    render(
      <SealBar
        projectId="proj-1"
        artifactStatus="sealed"
        canSeal={false}
        sealedByName="Miguel Robles"
        sealedAt={new Date().toISOString()}
      />
    );

    fireEvent.click(screen.getByText("Reabrir"));
    const textarea = await screen.findByPlaceholderText(/Explica por qué reabres/i);
    fireEvent.change(textarea, { target: { value: "Faltó información clave" } });
    fireEvent.click(screen.getByText("Confirmar reapertura"));

    await waitFor(() => expect(reopenContextBriefActionMock).toHaveBeenCalledWith({
      projectId: "proj-1",
      reason: "Faltó información clave",
    }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    // El componente en sí no cambia artifactStatus (lo controla el parent vía
    // props tras el router.refresh); vuelve a la vista "sellado" sin el
    // formulario de reapertura abierto.
    expect(screen.queryByPlaceholderText(/Explica por qué reabres/i)).not.toBeInTheDocument();
  });
});
