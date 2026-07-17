// @vitest-environment jsdom
// src/components/pixelforge/NewPixelforgeForm.test.tsx
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

const { createPixelforgeProjectActionMock, pushMock } = vi.hoisted(() => ({
  createPixelforgeProjectActionMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock("@/app/(admin)/proyectos/pixelforge/actions", () => ({
  createPixelforgeProjectAction: createPixelforgeProjectActionMock,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { NewPixelforgeForm } from "./NewPixelforgeForm";

const DRAFT_KEY = "pixelforge:new-draft";

const clients = [
  { crmId: "client-1", name: "Cliente Uno" },
  { crmId: "client-2", name: "Cliente Dos" },
];

const definitions = [
  { id: "def-1", title: "Definición A", clientCrmId: "client-1" },
  { id: "def-2", title: "Definición B", clientCrmId: "client-2" },
];

describe("NewPixelforgeForm — validación y botón", () => {
  it("el botón 'Crear proyecto' está disabled hasta que cliente + título + brainDump(>=20) sean válidos", () => {
    render(<NewPixelforgeForm clients={clients} definitions={definitions} />);
    const submit = screen.getByText("Crear proyecto");
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: "client-1" } });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/título/i), { target: { value: "Landing X" } });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/idea|problema|cabeza/i), {
      target: { value: "corto" },
    });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/idea|problema|cabeza/i), {
      target: { value: "Descripción con más de veinte caracteres" },
    });
    expect(submit).not.toBeDisabled();
  });
});

describe("NewPixelforgeForm — filtro de definiciones por cliente", () => {
  it("solo muestra las definiciones del cliente elegido", () => {
    render(<NewPixelforgeForm clients={clients} definitions={definitions} />);

    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: "client-1" } });
    expect(screen.getByText("Definición A")).toBeInTheDocument();
    expect(screen.queryByText("Definición B")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: "client-2" } });
    expect(screen.queryByText("Definición A")).not.toBeInTheDocument();
    expect(screen.getByText("Definición B")).toBeInTheDocument();
  });

  it("muestra texto muted cuando el cliente elegido no tiene definiciones completadas", () => {
    render(
      <NewPixelforgeForm clients={[{ crmId: "client-3", name: "Sin defs" }, ...clients]} definitions={definitions} />
    );
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: "client-3" } });
    expect(screen.getByText(/este cliente no tiene definiciones completadas/i)).toBeInTheDocument();
  });
});

describe("NewPixelforgeForm — submit", () => {
  it("llama a la action con el payload correcto y navega DIRECTO a la estación inicial (sin pasar por el [id] pelado, que re-redirige y crashea el shell)", async () => {
    createPixelforgeProjectActionMock.mockResolvedValue({
      success: true,
      data: { id: "proj-1", station: "contexto" },
    });
    render(<NewPixelforgeForm clients={clients} definitions={definitions} />);

    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: "client-1" } });
    fireEvent.change(screen.getByPlaceholderText(/título/i), { target: { value: "Landing X" } });
    fireEvent.change(screen.getByPlaceholderText(/idea|problema|cabeza/i), {
      target: { value: "Descripción con más de veinte caracteres" },
    });
    fireEvent.change(screen.getByLabelText(/importar de definición/i), { target: { value: "def-1" } });

    fireEvent.click(screen.getByText("Crear proyecto"));

    await waitFor(() =>
      expect(createPixelforgeProjectActionMock).toHaveBeenCalledWith({
        clientCrmId: "client-1",
        title: "Landing X",
        brainDump: "Descripción con más de veinte caracteres",
        definitionId: "def-1",
      })
    );
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/proyectos/pixelforge/proj-1/contexto")
    );
  });

  it("muestra toast.error y no navega cuando la action falla", async () => {
    createPixelforgeProjectActionMock.mockResolvedValue({ success: false, error: "Cliente no encontrado" });
    render(<NewPixelforgeForm clients={clients} definitions={definitions} />);

    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: "client-1" } });
    fireEvent.change(screen.getByPlaceholderText(/título/i), { target: { value: "Landing X" } });
    fireEvent.change(screen.getByPlaceholderText(/idea|problema|cabeza/i), {
      target: { value: "Descripción con más de veinte caracteres" },
    });
    fireEvent.click(screen.getByText("Crear proyecto"));

    await waitFor(() => expect(createPixelforgeProjectActionMock).toHaveBeenCalled());
    expect(pushMock).not.toHaveBeenCalled();
  });
});

describe("NewPixelforgeForm — borrador en localStorage", () => {
  it("restaura el borrador guardado al montar", () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ clientCrmId: "client-1", title: "Idea guardada", brainDump: "Contenido previo de prueba largo", definitionId: undefined })
    );
    render(<NewPixelforgeForm clients={clients} definitions={definitions} />);
    expect(screen.getByDisplayValue("Idea guardada")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Contenido previo de prueba largo")).toBeInTheDocument();
  });

  it("persiste en localStorage tras un debounce de escritura", () => {
    vi.useFakeTimers();
    render(<NewPixelforgeForm clients={clients} definitions={definitions} />);

    fireEvent.change(screen.getByPlaceholderText(/título/i), { target: { value: "Nueva idea" } });
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
    vi.advanceTimersByTime(600);

    const raw = window.localStorage.getItem(DRAFT_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).title).toBe("Nueva idea");
  });

  it("limpia el localStorage tras crear el proyecto exitosamente", async () => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ title: "x" }));
    createPixelforgeProjectActionMock.mockResolvedValue({
      success: true,
      data: { id: "proj-1", station: "contexto" },
    });
    render(<NewPixelforgeForm clients={clients} definitions={definitions} />);

    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: "client-1" } });
    fireEvent.change(screen.getByPlaceholderText(/título/i), { target: { value: "Landing X" } });
    fireEvent.change(screen.getByPlaceholderText(/idea|problema|cabeza/i), {
      target: { value: "Descripción con más de veinte caracteres" },
    });
    fireEvent.click(screen.getByText("Crear proyecto"));

    await waitFor(() => expect(pushMock).toHaveBeenCalled());
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});
