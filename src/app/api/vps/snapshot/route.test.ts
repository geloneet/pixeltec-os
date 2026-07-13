import { describe, expect, test, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { VpsSnapshot } from "@/lib/vps-types";

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

  test("returns an error status when fetchVpsApi throws", async () => {
    fetchVpsApiMock.mockRejectedValueOnce(new Error("vps-api unreachable"));

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain("vps-api unreachable");
  });
});
