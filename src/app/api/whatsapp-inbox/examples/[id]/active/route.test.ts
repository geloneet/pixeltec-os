import { describe, expect, test, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { requireAdminMock, fetchPixelbotMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  fetchPixelbotMock: vi.fn(),
}));

vi.mock("@/lib/auth-guards", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("@/lib/whatsapp-inbox/pixelbot-client", () => ({
  fetchPixelbot: fetchPixelbotMock,
}));

import { POST } from "./route";

function makeRequest(active: unknown) {
  return new NextRequest("http://localhost/api/whatsapp-inbox/examples/7/active", {
    method: "POST",
    body: JSON.stringify({ active }),
  });
}

describe("POST /api/whatsapp-inbox/examples/[id]/active", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    fetchPixelbotMock.mockReset();
    requireAdminMock.mockResolvedValue({ ok: true, uid: "admin-1", isAdmin: true });
  });

  test("activa/desactiva el ejemplo pegándole a /internal/examples/{id}/active", async () => {
    fetchPixelbotMock.mockResolvedValueOnce({ data: { id: 7, active: false }, status: 200 });

    const res = await POST(makeRequest(false), { params: Promise.resolve({ id: "7" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.active).toBe(false);
    expect(fetchPixelbotMock).toHaveBeenCalledWith("/internal/examples/7/active", { active: false }, "POST");
  });

  test("responde 400 si active no es booleano", async () => {
    const res = await POST(makeRequest("si"), { params: Promise.resolve({ id: "7" }) });

    expect(res.status).toBe(400);
    expect(fetchPixelbotMock).not.toHaveBeenCalled();
  });
});
