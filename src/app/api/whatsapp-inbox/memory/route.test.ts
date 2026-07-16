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

import { GET } from "./route";

function makeRequest(query?: string) {
  return new NextRequest(`http://localhost/api/whatsapp-inbox/memory${query ?? ""}`);
}

describe("GET /api/whatsapp-inbox/memory", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    fetchPixelbotMock.mockReset();
    requireAdminMock.mockResolvedValue({ ok: true, uid: "admin-1", isAdmin: true });
  });

  test("devuelve la memoria del contacto pegándole a /internal/memory con el phone", async () => {
    fetchPixelbotMock.mockResolvedValueOnce({
      data: { memory: [{ key: "name", value: "Juan", source: "customer", confidence: 0.9, expires_at: null, updated_at: "2026-07-11T18:30:00" }] },
      status: 200,
    });

    const res = await GET(makeRequest("?phone=%2B5213221234567"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.memory).toHaveLength(1);
    expect(body.memory[0].key).toBe("name");
    expect(fetchPixelbotMock).toHaveBeenCalledWith("/internal/memory?phone=%2B5213221234567", undefined, "GET");
  });

  test("responde 400 si falta el query param phone", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/phone/i);
    expect(fetchPixelbotMock).not.toHaveBeenCalled();
  });

  test("respeta el status de requireAdmin cuando no es admin", async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: false, error: "Forbidden", status: 403 });

    const res = await GET(makeRequest("?phone=%2B5213221234567"));

    expect(res.status).toBe(403);
    expect(fetchPixelbotMock).not.toHaveBeenCalled();
  });
});
