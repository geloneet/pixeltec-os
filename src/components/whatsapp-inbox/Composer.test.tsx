// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Composer } from "./Composer";

const addContactNote = vi.fn(async (_phone: string, _text: string) => ({}));
vi.mock("@/lib/whatsapp-inbox/contacts-client", () => ({
  addContactNote: (phone: string, text: string) => addContactNote(phone, text),
}));

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  addContactNote.mockClear();
  fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ status: "sent", phone: "+5210000000001" }),
  }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Composer — estados contextuales (§8.6)", () => {
  it("con el bot activo no muestra un campo bloqueado: explica y ofrece takeover", () => {
    render(<Composer phone="+5210000000001" mode="BOT" windowOpen />);
    expect(screen.getByText("El bot está atendiendo esta conversación.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tomar control y responder/ })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Escribe tu respuesta/)).not.toBeInTheDocument();
  });

  it("el takeover llama al contrato /mode con HUMAN", async () => {
    render(<Composer phone="+5210000000001" mode="BOT" windowOpen />);
    fireEvent.click(screen.getByRole("button", { name: /Tomar control y responder/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/whatsapp-inbox/mode");
    expect(JSON.parse(String(init.body))).toEqual({ phone: "+5210000000001", mode: "HUMAN" });
  });

  it("en control humano permite escribir y enviar con Enter", async () => {
    render(<Composer phone="+5210000000001" mode="HUMAN" windowOpen />);
    const input = screen.getByPlaceholderText("Escribe tu respuesta…");
    fireEvent.change(input, { target: { value: "hola" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("/api/whatsapp-inbox/send");
  });

  it("Shift+Enter no envía", () => {
    render(<Composer phone="+5210000000001" mode="HUMAN" windowOpen />);
    const input = screen.getByPlaceholderText("Escribe tu respuesta…");
    fireEvent.change(input, { target: { value: "hola" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("la nota interna nunca toca /send: usa el cliente de notas", async () => {
    render(<Composer phone="+5210000000001" mode="BOT" windowOpen />);
    fireEvent.click(screen.getByRole("button", { name: "Nota interna" }));
    const input = screen.getByPlaceholderText(/Nota interna/);
    fireEvent.change(input, { target: { value: "recordatorio" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(addContactNote).toHaveBeenCalledWith("+5210000000001", "recordatorio"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("con la ventana cerrada avisa que se requiere plantilla aprobada", () => {
    render(<Composer phone="+5210000000001" mode="HUMAN" windowOpen={false} />);
    expect(screen.getByText(/plantilla aprobada/)).toBeInTheDocument();
    // El comportamiento actual se conserva: el envío sigue permitido.
    expect(screen.getByPlaceholderText("Escribe tu respuesta…")).toBeEnabled();
  });
});
