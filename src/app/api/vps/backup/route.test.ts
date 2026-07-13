import { describe, expect, test, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { VpsBackupResult } from "@/lib/vps-types";

const { fetchVpsApiMock, authMock } = vi.hoisted(() => ({
  fetchVpsApiMock: vi.fn(),
  authMock: vi.fn(),
}));

vi.mock("@/lib/vpsClient", () => ({
  fetchVpsApi: fetchVpsApiMock,
}));

vi.mock("@/lib/auth-guards", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ ok: true, uid: "user-1", isAdmin: true }),
}));

vi.mock("@/lib/auth/config", () => ({
  auth: authMock,
}));

import { POST } from "./route";

const canned: VpsBackupResult = { ok: true, durationMs: 4200, tail: "backup complete" };

function makeRequest(body: unknown = {}) {
  return new NextRequest("http://localhost/api/vps/backup", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/vps/backup", () => {
  beforeEach(() => {
    fetchVpsApiMock.mockReset();
    authMock.mockReset();
  });

  test("returns the backup result as JSON with 200 and sends the actor from the session, ignoring the body", async () => {
    authMock.mockResolvedValue({ user: { name: "Miguel Robles", email: "miguel@pixeltec.mx" } });
    fetchVpsApiMock.mockResolvedValueOnce({ ok: true, status: 200, data: canned });

    const res = await POST(makeRequest({ actor: "someone-else-untrusted" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(canned);
    expect(fetchVpsApiMock).toHaveBeenCalledWith("/actions/backup", {
      method: "POST",
      body: { actor: "Miguel Robles" },
    });
  });

  test("falls back to the session uid when the session has no name/email", async () => {
    authMock.mockResolvedValue({ user: {} });
    fetchVpsApiMock.mockResolvedValueOnce({ ok: true, status: 200, data: canned });

    await POST(makeRequest());

    expect(fetchVpsApiMock).toHaveBeenCalledWith("/actions/backup", {
      method: "POST",
      body: { actor: "user-1" },
    });
  });

  test("returns an error status when fetchVpsApi throws", async () => {
    authMock.mockResolvedValue({ user: { name: "Miguel Robles" } });
    fetchVpsApiMock.mockRejectedValueOnce(new Error("disk full"));

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain("disk full");
  });
});
