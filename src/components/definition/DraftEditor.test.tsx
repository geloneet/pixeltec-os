// @vitest-environment jsdom
// src/components/definition/DraftEditor.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { DefinitionViewModel } from "./view-model";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

const { updateDraftActionMock, startDefinitionActionMock, pushMock, refreshMock } = vi.hoisted(() => ({
  updateDraftActionMock: vi.fn(),
  startDefinitionActionMock: vi.fn(),
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("@/app/(admin)/proyectos/definicion/actions", () => ({
  updateDraftAction: updateDraftActionMock,
  startDefinitionAction: startDefinitionActionMock,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

import { DraftEditor } from "./DraftEditor";

function buildViewModel(overrides: Partial<DefinitionViewModel> = {}): DefinitionViewModel {
  return {
    id: "def-1",
    title: "Borrador inicial",
    brainDump: "Descarga mental inicial con suficiente longitud",
    clientName: "Cliente de prueba",
    clientCrmId: "client-1",
    currentStation: "boceto",
    status: "draft",
    proposalId: null,
    stations: [],
    messagesByStation: { boceto: [], funciones: [], mvp: [], flujo: [] },
    events: [],
    ...overrides,
  };
}

describe("DraftEditor — autoguardado server-side", () => {
  it("llama a updateDraftAction sin toast tras el debounce de inactividad", () => {
    vi.useFakeTimers();
    updateDraftActionMock.mockResolvedValue({ success: true });
    render(<DraftEditor data={buildViewModel()} />);

    fireEvent.change(screen.getByDisplayValue("Borrador inicial"), {
      target: { value: "Borrador editado" },
    });

    expect(updateDraftActionMock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1600);

    expect(updateDraftActionMock).toHaveBeenCalledWith({
      definitionId: "def-1",
      title: "Borrador editado",
      brainDump: "Descarga mental inicial con suficiente longitud",
    });
  });

  it("no dispara el autoguardado antes de que pase el debounce completo", () => {
    vi.useFakeTimers();
    render(<DraftEditor data={buildViewModel()} />);

    fireEvent.change(screen.getByDisplayValue("Borrador inicial"), {
      target: { value: "a medio escribir" },
    });
    vi.advanceTimersByTime(1000);

    expect(updateDraftActionMock).not.toHaveBeenCalled();
  });

  it("no dispara autoguardado si el usuario no hizo cambios", () => {
    vi.useFakeTimers();
    render(<DraftEditor data={buildViewModel()} />);

    // No cambios: solo avanzo el timer
    vi.advanceTimersByTime(1600);

    expect(updateDraftActionMock).not.toHaveBeenCalled();
  });
});
