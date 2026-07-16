import { describe, expect, test, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { requireAdminMock, fetchPixelbotMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  fetchPixelbotMock: vi.fn(),
}));

vi.mock("@/lib/auth-guards", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/lib/whatsapp-inbox/pixelbot-client", () => ({ fetchPixelbot: fetchPixelbotMock }));

import { POST } from "./route";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/whatsapp-inbox/simulate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/whatsapp-inbox/simulate", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    fetchPixelbotMock.mockReset();
    requireAdminMock.mockResolvedValue({ ok: true, uid: "admin-1", isAdmin: true });
  });

  test("simula un mensaje pegándole a /internal/simulate", async () => {
    fetchPixelbotMock.mockResolvedValueOnce({
      data: { respuesta: "hola, en qué te ayudo", escalaria: false, simulacion: true, version_simulada: null },
      status: 200,
    });

    const res = await POST(makeRequest({ message: "hola" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.respuesta).toBe("hola, en qué te ayudo");
    expect(fetchPixelbotMock).toHaveBeenCalledWith("/internal/simulate", { message: "hola" }, "POST");
  });

  test("reenvía phone/mode/version cuando vienen presentes", async () => {
    fetchPixelbotMock.mockResolvedValueOnce({ data: {}, status: 200 });

    await POST(makeRequest({ message: "hola", phone: "+5213221234567", mode: "BOT", version: 4 }));

    expect(fetchPixelbotMock).toHaveBeenCalledWith(
      "/internal/simulate",
      { message: "hola", phone: "+5213221234567", mode: "BOT", version: 4 },
      "POST"
    );
  });

  test("responde 400 si falta message", async () => {
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
    expect(fetchPixelbotMock).not.toHaveBeenCalled();
  });
});
