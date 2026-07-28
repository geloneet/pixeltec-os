import { describe, expect, test, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { VpsSnapshot } from "@/lib/vps-types";
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

const canned: VpsSnapshot = {
  generatedAt: "2026-07-13T00:00:00.000Z",
  disk: { size: "80G", used: "40G", avail: "40G", usedPct: 50 },
  host: { ramUsedPct: 62, load1: 0.4, nproc: 4, crashLoops: [] },
  services: [
    {
      id: "crm",
      name: "CRM",
      domain: "crm.pixeltec.mx",
      status: "up",
      httpOk: true,
      httpCode: 200,
    },
  ],
  certs: [{ domain: "crm.pixeltec.mx", expiresAt: "2026-10-01T00:00:00.000Z", daysLeft: 80 }],
  databases: [{ name: "crm", size: "1.2G", lastBackupAgeHrs: 5 }],
  backups: { ok: true, lastRunAgeHrs: 5, coverageMissing: [], offsite: true },
  security: {
    securityUpdates: 0,
    publicPortsOutOfPolicy: [],
    sshPassword: false,
    secretsInLogs: [],
  },
};

function makeRequest() {
  return new NextRequest("http://localhost/api/vps/snapshot");
}

describe("GET /api/vps/snapshot", () => {
  beforeEach(() => {
    fetchVpsApiMock.mockReset();
  });

  test("returns the snapshot as JSON with 200", async () => {
    fetchVpsApiMock.mockResolvedValueOnce({ ok: true, status: 200, data: canned });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(canned);
    expect(fetchVpsApiMock).toHaveBeenCalledWith("/health/snapshot");
  });

  test("un error desconocido devuelve 500 sin filtrar su message", async () => {
    // Afirmaba `toContain("vps-api unreachable")`: fijaba la fuga como
    // contrato. El mismo camino traía SQL y nombres de variables de entorno.
    fetchVpsApiMock.mockRejectedValueOnce(
      new Error("vps-api unreachable — VPS_API_SECRET missing — SELECT 1 FROM projects")
    );

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to fetch VPS snapshot");
    expect(body.code).toBe("vps_snapshot_failed");
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("unreachable");
    expect(serialized).not.toContain("VPS_API_SECRET");
    expect(serialized).not.toContain("SELECT");
  });

  test("un VpsTransportError conserva su código y el status upstream", async () => {
    fetchVpsApiMock.mockRejectedValueOnce(new VpsTransportError("vps_redirect_blocked", 302));

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe("vps_redirect_blocked");
    expect(body.upstreamStatus).toBe(302);
    expect(JSON.stringify(body)).not.toContain("VPS_TRANSPORT_ERROR");
  });
});
