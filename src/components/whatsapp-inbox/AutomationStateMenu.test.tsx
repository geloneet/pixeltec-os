// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AutomationStateMenu } from "./AutomationStateMenu";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ status: "ok", phone: "+5210000000001", previous_mode: "BOT", mode: "HUMAN" }),
  }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AutomationStateMenu — control único de automatización (§8.4)", () => {
  it("expresa el estado actual con lenguaje de producto", () => {
    render(<AutomationStateMenu phone="+5210000000001" mode="BOT" />);
    expect(screen.getByText("Bot respondiendo")).toBeInTheDocument();

    cleanup();
    render(<AutomationStateMenu phone="+5210000000001" mode="HUMAN" />);
    expect(screen.getByText("Control humano")).toBeInTheDocument();

    cleanup();
    render(<AutomationStateMenu phone="+5210000000001" mode="PAUSED" />);
    expect(screen.getByText("Bot pausado")).toBeInTheDocument();
  });

  it("resuelve la pausa temporal a 'hasta HH:MM' en el trigger", () => {
    const future = new Date(Date.now() + 45 * 60_000).toISOString();
    render(<AutomationStateMenu phone="+5210000000001" mode="PAUSED" pausedUntil={future} />);
    expect(screen.getByText(/Bot pausado hasta \d{2}:\d{2}/)).toBeInTheDocument();
  });

  it("ofrece Tomar control / Devolver al bot según el estado y respeta el contrato /mode", async () => {
    const onChanged = vi.fn();
    render(<AutomationStateMenu phone="+5210000000001" mode="BOT" onChanged={onChanged} />);
    fireEvent.keyDown(screen.getByRole("button", { name: /Automatización/ }), { key: "Enter" });
    // En modo BOT no tiene sentido "Devolver al bot".
    expect(screen.queryByText("Devolver al bot")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Tomar control"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/whatsapp-inbox/mode");
    expect(JSON.parse(String(init.body))).toEqual({ phone: "+5210000000001", mode: "HUMAN" });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("las pausas temporales mandan pausedUntil ISO en el payload", async () => {
    render(<AutomationStateMenu phone="+5210000000001" mode="BOT" />);
    fireEvent.keyDown(screen.getByRole("button", { name: /Automatización/ }), { key: "Enter" });
    fireEvent.click(screen.getByText("Pausar 30 min"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { mode: string; pausedUntil?: string };
    expect(body.mode).toBe("PAUSED");
    expect(body.pausedUntil).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("'Pausar hasta resolver' no manda pausedUntil", async () => {
    render(<AutomationStateMenu phone="+5210000000001" mode="BOT" />);
    fireEvent.keyDown(screen.getByRole("button", { name: /Automatización/ }), { key: "Enter" });
    fireEvent.click(screen.getByText("Pausar hasta resolver"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ phone: "+5210000000001", mode: "PAUSED" });
  });

  it("muestra el error de la API sin cambiar el estado", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ error: "PixelBot no disponible" }),
    });
    render(<AutomationStateMenu phone="+5210000000001" mode="BOT" />);
    fireEvent.keyDown(screen.getByRole("button", { name: /Automatización/ }), { key: "Enter" });
    fireEvent.click(screen.getByText("Tomar control"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // El trigger sigue expresando el estado original.
    expect(screen.getByText("Bot respondiendo")).toBeInTheDocument();
  });
});
