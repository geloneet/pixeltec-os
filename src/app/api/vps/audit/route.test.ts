import { describe, expect, test, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { VpsAuditReport } from "@/lib/vps-types";

const { fetchVpsApiMock } = vi.hoisted(() => ({
  fetchVpsApiMock: vi.fn(),
}));

vi.mock("@/lib/vpsClient", () => ({
  fetchVpsApi: fetchVpsApiMock,
}));

vi.mock("@/lib/auth-guards", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ ok: true, uid: "user-1", isAdmin: true }),
}));

import { GET } from "./route";

const canned: VpsAuditReport = {
  symptoms: [
    {
      id: "disk-usage-high",
      severity: "yellow",
      area: "disk",
      message: "Uso de disco al 85%",
      suggestedAction: "Liberar espacio o expandir volumen",
      evidence: { usedPct: 85 },
    },
  ],
  summary: { red: 0, yellow: 1, green: 5 },
  generatedAt: "2026-07-13T00:00:00.000Z",
};

function makeRequest() {
  return new NextRequest("http://localhost/api/vps/audit");
}

describe("GET /api/vps/audit", () => {
  beforeEach(() => {
    fetchVpsApiMock.mockReset();
  });

  test("returns the audit report as JSON with 200", async () => {
    fetchVpsApiMock.mockResolvedValueOnce({ ok: true, status: 200, data: canned });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(canned);
    expect(fetchVpsApiMock).toHaveBeenCalledWith("/health/audit");
  });

  test("returns an error status when fetchVpsApi throws", async () => {
    fetchVpsApiMock.mockRejectedValueOnce(new Error("timed out"));

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain("timed out");
  });
});
