import { describe, expect, test, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { requireAdminMock, fetchPixelbotMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  fetchPixelbotMock: vi.fn(),
}));

vi.mock("@/lib/auth-guards", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/lib/whatsapp-inbox/pixelbot-client", () => ({ fetchPixelbot: fetchPixelbotMock }));

import { GET } from "./route";

describe("GET /api/whatsapp-inbox/config/versions", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    fetchPixelbotMock.mockReset();
    requireAdminMock.mockResolvedValue({ ok: true, uid: "admin-1", isAdmin: true });
  });

  test("lista las versiones pegándole a /internal/config/versions", async () => {
    fetchPixelbotMock.mockResolvedValueOnce({
      data: { versions: [{ version: 3, status: "active", created_at: "2026-07-11T00:00:00", created_by: "admin-1", published_at: "2026-07-11T00:05:00" }] },
      status: 200,
    });

    const res = await GET(new NextRequest("http://localhost/api/whatsapp-inbox/config/versions"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.versions[0].version).toBe(3);
    expect(fetchPixelbotMock).toHaveBeenCalledWith("/internal/config/versions", undefined, "GET");
  });

  test("respeta el status de requireAdmin cuando no es admin", async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: false, error: "Forbidden", status: 403 });

    const res = await GET(new NextRequest("http://localhost/api/whatsapp-inbox/config/versions"));

    expect(res.status).toBe(403);
    expect(fetchPixelbotMock).not.toHaveBeenCalled();
  });
});
