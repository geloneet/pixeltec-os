import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ auth: authMock }));

vi.mock("@/lib/db/repos/pixelforge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/repos/pixelforge")>();
  return {
    ...actual,
    getQaRunWithFindings: vi.fn(),
    sweepStaleQaRuns: vi.fn(),
  };
});

vi.mock("@/lib/pixelforge/qa/finalize", () => ({ finalizeQaRunOrchestrated: vi.fn() }));

import { GET } from "./route";
import { getQaRunWithFindings, sweepStaleQaRuns } from "@/lib/db/repos/pixelforge";
import { finalizeQaRunOrchestrated } from "@/lib/pixelforge/qa/finalize";

const OWNER_ID = "owner-1";
const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const QA_RUN_ID = "22222222-2222-2222-2222-222222222222";

function makeRequest() {
  return new NextRequest(`http://localhost/api/pixelforge/qa/runs/${QA_RUN_ID}`);
}

function makeParams() {
  return { params: Promise.resolve({ qaRunId: QA_RUN_ID }) };
}

beforeEach(() => {
  // `resetAllMocks` — ver nota en `../route.test.ts`: `clearAllMocks` no
  // limpia la implementación de un mock, solo su historial de llamadas.
  vi.resetAllMocks();
  authMock.mockResolvedValue({ user: { id: OWNER_ID, name: "Miguel" } });
  (sweepStaleQaRuns as ReturnType<typeof vi.fn>).mockResolvedValue(0);
  (finalizeQaRunOrchestrated as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
});

describe("GET /api/pixelforge/qa/runs/:qaRunId", () => {
  it("401 si no hay sesión", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it("404 si el QA no existe o no es del owner (IDOR — getQaRunWithFindings ya escopa por ownerId)", async () => {
    (getQaRunWithFindings as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(404);
    expect(getQaRunWithFindings).toHaveBeenCalledWith(QA_RUN_ID, OWNER_ID);
  });

  it("si el run sigue 'running', invoca finalizeQaRunOrchestrated antes de responder", async () => {
    (getQaRunWithFindings as ReturnType<typeof vi.fn>).mockResolvedValue({
      run: { id: QA_RUN_ID, projectId: PROJECT_ID, status: "running" },
      findings: [],
    });

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(200);
    expect(sweepStaleQaRuns).toHaveBeenCalledWith(PROJECT_ID);
    expect(finalizeQaRunOrchestrated).toHaveBeenCalledWith(QA_RUN_ID);
  });

  it("si el run ya está terminal (succeeded), NO invoca finalizeQaRunOrchestrated", async () => {
    (getQaRunWithFindings as ReturnType<typeof vi.fn>).mockResolvedValue({
      run: { id: QA_RUN_ID, projectId: PROJECT_ID, status: "succeeded" },
      findings: [],
    });

    await GET(makeRequest(), makeParams());

    expect(finalizeQaRunOrchestrated).not.toHaveBeenCalled();
  });

  it("devuelve el estado RE-LEÍDO tras el finalize (puede haber cambiado)", async () => {
    (getQaRunWithFindings as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ run: { id: QA_RUN_ID, projectId: PROJECT_ID, status: "running" }, findings: [] })
      .mockResolvedValueOnce({ run: { id: QA_RUN_ID, projectId: PROJECT_ID, status: "succeeded" }, findings: [] });

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(body.run.status).toBe("succeeded");
    expect(getQaRunWithFindings).toHaveBeenCalledTimes(2);
  });
});
