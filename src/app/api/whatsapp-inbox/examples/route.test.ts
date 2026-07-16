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

import { GET, POST } from "./route";

function makeGetRequest(query?: string) {
  return new NextRequest(`http://localhost/api/whatsapp-inbox/examples${query ?? ""}`);
}

function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/whatsapp-inbox/examples", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("/api/whatsapp-inbox/examples", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    fetchPixelbotMock.mockReset();
    requireAdminMock.mockResolvedValue({ ok: true, uid: "admin-1", isAdmin: true });
  });

  describe("GET", () => {
    test("lista los ejemplos pegándole a /internal/examples", async () => {
      fetchPixelbotMock.mockResolvedValueOnce({
        data: { examples: [{ id: 1, customer_msg: "hola", ideal_reply: "hola, en qué te ayudo", category: null, intent: null, tags: [], manual_priority: 0, active: true, created_at: "2026-07-11T00:00:00", created_by: "admin-1" }] },
        status: 200,
      });

      const res = await GET(makeGetRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.examples).toHaveLength(1);
      expect(fetchPixelbotMock).toHaveBeenCalledWith("/internal/examples", undefined, "GET");
    });

    test("reenvía active_only cuando viene en el query string", async () => {
      fetchPixelbotMock.mockResolvedValueOnce({ data: { examples: [] }, status: 200 });

      await GET(makeGetRequest("?active_only=true"));

      expect(fetchPixelbotMock).toHaveBeenCalledWith("/internal/examples?active_only=true", undefined, "GET");
    });
  });

  describe("POST", () => {
    test("crea un ejemplo inyectando created_by_uid desde el guard", async () => {
      fetchPixelbotMock.mockResolvedValueOnce({ data: { id: 7 }, status: 200 });

      const res = await POST(
        makePostRequest({ customer_msg: "cuánto cuesta", ideal_reply: "depende del alcance", tags: ["precio"] })
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.id).toBe(7);
      expect(fetchPixelbotMock).toHaveBeenCalledWith(
        "/internal/examples",
        expect.objectContaining({
          customer_msg: "cuánto cuesta",
          ideal_reply: "depende del alcance",
          tags: ["precio"],
          created_by_uid: "admin-1",
        }),
        "POST"
      );
    });

    test("responde 400 si falta customer_msg o ideal_reply", async () => {
      const res = await POST(makePostRequest({ customer_msg: "", ideal_reply: "algo" }));

      expect(res.status).toBe(400);
      expect(fetchPixelbotMock).not.toHaveBeenCalled();
    });
  });

  test("respeta el status de requireAdmin cuando no es admin", async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: false, error: "Forbidden", status: 403 });

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(403);
    expect(fetchPixelbotMock).not.toHaveBeenCalled();
  });
});
