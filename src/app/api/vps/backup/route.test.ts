import { describe, expect, test, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { VpsBackupResult } from "@/lib/vps-types";
import { VpsTransportError } from "@/lib/vpsClient";

const { fetchVpsApiMock, authMock } = vi.hoisted(() => ({
  fetchVpsApiMock: vi.fn(),
  authMock: vi.fn(),
}));

// `importActual` conserva `VpsTransportError`: `toRouteFailure` lo reconoce por
// `instanceof`, así que un mock que sólo exporte `fetchVpsApi` dejaría la clase
// en `undefined` y el `instanceof` lanzaría dentro del helper.
vi.mock("@/lib/vpsClient", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/vpsClient")>()),
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

  test("un error desconocido devuelve 500 sin filtrar su message", async () => {
    // Este test afirmaba lo contrario —`toContain("disk full")`—, es decir,
    // fijaba la fuga como contrato. "disk full" es benigno, pero el mismo
    // camino traía el SQL de Drizzle y el nombre de `VPS_API_SECRET`.
    authMock.mockResolvedValue({ user: { name: "Miguel Robles" } });
    fetchVpsApiMock.mockRejectedValueOnce(
      new Error("disk full: SELECT * FROM projects — VPS_API_SECRET is not set")
    );

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Backup failed");
    expect(body.code).toBe("vps_backup_failed");
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("disk full");
    expect(serialized).not.toContain("SELECT");
    expect(serialized).not.toContain("VPS_API_SECRET");
  });

  test("un VpsTransportError conserva su código y el status upstream", async () => {
    authMock.mockResolvedValue({ user: { name: "Miguel Robles" } });
    fetchVpsApiMock.mockRejectedValueOnce(new VpsTransportError("vps_timeout", 504));

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe("vps_timeout");
    expect(body.upstreamStatus).toBe(504);
    // El prefijo interno de la clase no viaja.
    expect(JSON.stringify(body)).not.toContain("VPS_TRANSPORT_ERROR");
  });
});
