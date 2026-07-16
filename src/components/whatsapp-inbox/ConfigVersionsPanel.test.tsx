// @vitest-environment jsdom
// src/components/whatsapp-inbox/ConfigVersionsPanel.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConfigVersionsPanel } from "./ConfigVersionsPanel";

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body };
}

describe("ConfigVersionsPanel — versionado + playground (Fase 4)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("lista las versiones cargadas desde /api/whatsapp-inbox/config/versions", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({
        versions: [
          { version: 3, status: "active", created_at: "2026-07-11T00:00:00", created_by: "admin-1", published_at: "2026-07-11T00:05:00" },
          { version: 2, status: "archived", created_at: "2026-07-10T00:00:00", created_by: "admin-1", published_at: "2026-07-10T00:05:00" },
        ],
      })
    );

    render(<ConfigVersionsPanel />);

    expect(await screen.findByText("v3")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("publica una versión en borrador", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ versions: [{ version: 4, status: "draft", created_at: "2026-07-11T00:00:00", created_by: "admin-1", published_at: null }] }))
      .mockResolvedValueOnce(jsonResponse({ config: { bot_name: "PixelBot" } }));

    render(<ConfigVersionsPanel />);
    await screen.findByText("v4");

    fireEvent.click(screen.getByText("Publicar"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/whatsapp-inbox/config/publish");
    expect(JSON.parse(options.body as string)).toEqual({ version: 4 });
  });

  it("simula un mensaje y muestra la respuesta del bot", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ versions: [] })) // GET versions inicial
      .mockResolvedValueOnce(
        jsonResponse({
          modo: "BOT",
          fuera_de_horario: false,
          respuesta: "Hola, en qué te ayudo",
          escalaria: false,
          razon_escalamiento: null,
          intent_detectado: "saludo",
          confianza: 0.9,
          ejemplos_seleccionados: [],
          memoria_usada: {},
          memoria_nueva_detectada: null,
          reglas_aplicadas: [],
          prompt_preview: null,
          simulacion: true,
          version_simulada: null,
        })
      );

    render(<ConfigVersionsPanel />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText(/mensaje de prueba/i), { target: { value: "hola" } });
    fireEvent.click(screen.getByText("Simular"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/whatsapp-inbox/simulate");
    expect(JSON.parse(options.body as string)).toEqual({ message: "hola" });

    expect(await screen.findByText("Hola, en qué te ayudo")).toBeInTheDocument();
  });
});
