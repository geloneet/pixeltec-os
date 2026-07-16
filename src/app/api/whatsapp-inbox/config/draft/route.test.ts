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
  return new NextRequest("http://localhost/api/whatsapp-inbox/config/draft", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/whatsapp-inbox/config/draft", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    fetchPixelbotMock.mockReset();
    requireAdminMock.mockResolvedValue({ ok: true, uid: "admin-1", isAdmin: true });
  });

  test("crea un borrador inyectando created_by_uid desde el guard", async () => {
    fetchPixelbotMock.mockResolvedValueOnce({ data: { version: 4, status: "draft", config: { bot_name: "PixelBot" } }, status: 200 });

    const res = await POST(makeRequest({ config: { bot_name: "PixelBot" } }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.version).toBe(4);
    expect(fetchPixelbotMock).toHaveBeenCalledWith(
      "/internal/config/draft",
      { config: { bot_name: "PixelBot" }, created_by_uid: "admin-1" },
      "POST"
    );
  });

  test("responde 400 si config no es un objeto", async () => {
    const res = await POST(makeRequest({ config: "no-es-objeto" }));

    expect(res.status).toBe(400);
    expect(fetchPixelbotMock).not.toHaveBeenCalled();
  });
});
