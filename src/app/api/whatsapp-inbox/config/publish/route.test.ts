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
  return new NextRequest("http://localhost/api/whatsapp-inbox/config/publish", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/whatsapp-inbox/config/publish", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    fetchPixelbotMock.mockReset();
    requireAdminMock.mockResolvedValue({ ok: true, uid: "admin-1", isAdmin: true });
  });

  test("publica una version inyectando published_by_uid desde el guard", async () => {
    fetchPixelbotMock.mockResolvedValueOnce({ data: { config: { bot_name: "PixelBot" } }, status: 200 });

    const res = await POST(makeRequest({ version: 4 }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.config.bot_name).toBe("PixelBot");
    expect(fetchPixelbotMock).toHaveBeenCalledWith(
      "/internal/config/publish",
      { version: 4, published_by_uid: "admin-1" },
      "POST"
    );
  });

  test("responde 400 si version no es un numero", async () => {
    const res = await POST(makeRequest({ version: "cuatro" }));

    expect(res.status).toBe(400);
    expect(fetchPixelbotMock).not.toHaveBeenCalled();
  });
});
