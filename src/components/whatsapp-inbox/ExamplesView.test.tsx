// @vitest-environment jsdom
// src/components/whatsapp-inbox/ExamplesView.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { BotExample } from "@/types/whatsapp-inbox";
import { ExamplesView } from "./ExamplesView";

function buildExample(overrides: Partial<BotExample> = {}): BotExample {
  return {
    id: 1,
    customer_msg: "¿Cuánto cuesta una página web?",
    ideal_reply: "Depende del alcance, ¿me cuentas qué necesitas?",
    category: "precio",
    intent: null,
    tags: ["precio"],
    manual_priority: 0,
    active: true,
    created_at: "2026-07-11T00:00:00",
    created_by: "admin-1",
    ...overrides,
  };
}

describe("ExamplesView — biblioteca de ejemplos few-shot (Fase 3)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("lista los ejemplos cargados desde /api/whatsapp-inbox/examples", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ examples: [buildExample()] }),
    });

    render(<ExamplesView />);

    expect(await screen.findByText("¿Cuánto cuesta una página web?")).toBeInTheDocument();
    expect(screen.getByText("Depende del alcance, ¿me cuentas qué necesitas?")).toBeInTheDocument();
  });

  it("crea un ejemplo nuevo con el formulario y lo agrega a la lista", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ examples: [] }) }) // GET inicial
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 9 }) }); // POST crear

    render(<ExamplesView />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.change(await screen.findByPlaceholderText(/mensaje del cliente/i), {
      target: { value: "hola buenas" },
    });
    fireEvent.change(screen.getByPlaceholderText(/respuesta ideal/i), {
      target: { value: "hola, en qué te ayudo" },
    });
    fireEvent.click(screen.getByText("Agregar ejemplo"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [, postOptions] = fetchMock.mock.calls[1];
    const body = JSON.parse(postOptions.body as string);
    expect(body.customer_msg).toBe("hola buenas");
    expect(body.ideal_reply).toBe("hola, en qué te ayudo");

    expect(await screen.findByText("hola buenas")).toBeInTheDocument();
  });

  it("activa/desactiva un ejemplo con el switch", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ examples: [buildExample({ active: true })] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1, active: false }) });

    render(<ExamplesView />);
    await screen.findByText("¿Cuánto cuesta una página web?");

    fireEvent.click(screen.getByRole("switch"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/whatsapp-inbox/examples/1/active",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ active: false }) })
    );
  });
});
