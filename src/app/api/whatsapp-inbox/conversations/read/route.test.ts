import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const { requireAdminMock, fetchPixelbotMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  fetchPixelbotMock: vi.fn(),
}));

vi.mock("@/lib/auth-guards", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/lib/whatsapp-inbox/pixelbot-client", () => ({ fetchPixelbot: fetchPixelbotMock }));

import { POST } from "./route";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/whatsapp-inbox/conversations/read", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/whatsapp-inbox/conversations/read", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    fetchPixelbotMock.mockReset();
    requireAdminMock.mockResolvedValue({ ok: true, uid: "admin-1", isAdmin: true });
    vi.stubEnv("PIXELBOT_TENANT_ID", "pixeltec");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("marca la conversación como leída pegándole a /internal/conversations/read", async () => {
    fetchPixelbotMock.mockResolvedValueOnce({
      data: { status: "ok", phone: "+5213221234567", unreadCount: 0 },
      status: 200,
    });

    const res = await POST(makeRequest({ phone: "+5213221234567" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.unreadCount).toBe(0);
    expect(fetchPixelbotMock).toHaveBeenCalledWith(
      "/internal/conversations/read",
      { tenant_id: "pixeltec", phone: "+5213221234567" },
      "POST"
    );
  });

  test("responde 400 si falta phone", async () => {
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
    expect(fetchPixelbotMock).not.toHaveBeenCalled();
  });

  test("responde 503 si falta PIXELBOT_TENANT_ID", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("PIXELBOT_TENANT_ID", "");

    const res = await POST(makeRequest({ phone: "+5213221234567" }));

    expect(res.status).toBe(503);
    expect(fetchPixelbotMock).not.toHaveBeenCalled();
  });

  test("respeta el status de requireAdmin cuando no es admin", async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: false, error: "Forbidden", status: 403 });

    const res = await POST(makeRequest({ phone: "+5213221234567" }));

    expect(res.status).toBe(403);
    expect(fetchPixelbotMock).not.toHaveBeenCalled();
  });
});
