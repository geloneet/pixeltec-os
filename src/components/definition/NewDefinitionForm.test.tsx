// @vitest-environment jsdom
// src/components/definition/NewDefinitionForm.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

beforeEach(() => {
  window.localStorage.clear();
});

const { createDefinitionActionMock, pushMock } = vi.hoisted(() => ({
  createDefinitionActionMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock("@/app/(admin)/proyectos/definicion/actions", () => ({
  createDefinitionAction: createDefinitionActionMock,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { NewDefinitionForm } from "./NewDefinitionForm";

const DRAFT_KEY = "definicion-draft-client-1";

describe("NewDefinitionForm — autoguardado en localStorage", () => {
  it("restaura título y descarga mental guardados al montar", () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ title: "Idea guardada", brainDump: "Contenido previo largo de prueba" })
    );

    render(<NewDefinitionForm clientCrmId="client-1" clientName="Cliente" />);

    expect(screen.getByDisplayValue("Idea guardada")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Contenido previo largo de prueba")).toBeInTheDocument();
  });

  it("persiste en localStorage tras un debounce de escritura", async () => {
    vi.useFakeTimers();
    render(<NewDefinitionForm clientCrmId="client-1" clientName="Cliente" />);

    fireEvent.change(screen.getByPlaceholderText("Ej. Rediseño del portal de clientes"), {
      target: { value: "Nueva idea" },
    });

    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
    vi.advanceTimersByTime(600);

    const raw = window.localStorage.getItem(DRAFT_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).title).toBe("Nueva idea");
  });

  it("limpia el localStorage al guardar el borrador exitosamente", async () => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ title: "x", brainDump: "y" }));
    createDefinitionActionMock.mockResolvedValue({ success: true, data: { id: "def-1" } });

    render(<NewDefinitionForm clientCrmId="client-1" clientName="Cliente" />);
    fireEvent.change(screen.getByPlaceholderText("Ej. Rediseño del portal de clientes"), {
      target: { value: "Título válido" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Escribe tu idea, los problemas a solucionar o todo lo que tengas en la cabeza para poder aterrizarlo…"),
      { target: { value: "Descarga mental con más de veinte caracteres" } }
    );
    fireEvent.click(screen.getByText("Guardar borrador"));

    await waitFor(() => expect(createDefinitionActionMock).toHaveBeenCalled());
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});
