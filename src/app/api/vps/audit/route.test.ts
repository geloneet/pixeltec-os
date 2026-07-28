import { describe, expect, test, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { VpsAuditReport } from "@/lib/vps-types";
import { VpsTransportError } from "@/lib/vpsClient";

const { fetchVpsApiMock } = vi.hoisted(() => ({
  fetchVpsApiMock: vi.fn(),
}));

// Ver nota en `backup/route.test.ts`: el mock debe conservar
// `VpsTransportError`, que `toRouteFailure` reconoce por `instanceof`.
vi.mock("@/lib/vpsClient", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/vpsClient")>()),
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

  test("un error desconocido devuelve 500 sin filtrar su message", async () => {
    // Afirmaba `toContain("timed out")`: el tercer test que fijaba la fuga
    // como contrato (los otros dos, en `backup` y `snapshot`).
    fetchVpsApiMock.mockRejectedValueOnce(
      new Error("timed out — VPS_API_SECRET is not set — SELECT * FROM audit_log")
    );

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to fetch VPS audit");
    expect(body.code).toBe("vps_audit_failed");
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("timed out");
    expect(serialized).not.toContain("VPS_API_SECRET");
    expect(serialized).not.toContain("SELECT");
  });

  test("un VpsTransportError conserva su código y el status upstream", async () => {
    fetchVpsApiMock.mockRejectedValueOnce(new VpsTransportError("vps_invalid_response", 502));

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe("vps_invalid_response");
    expect(body.upstreamStatus).toBe(502);
    expect(JSON.stringify(body)).not.toContain("VPS_TRANSPORT_ERROR");
  });
});
