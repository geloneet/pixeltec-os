import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mismo criterio que `src/app/api/pixelforge/runs/route.test.ts`: mockear
// `@/lib/auth/config` para poder importar el módulo sin arrastrar next-auth
// bajo Vitest (Node ESM puro).
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ auth: authMock }));

// Mock PARCIAL del repo (`importOriginal` conserva `QaRunAlreadyActiveError`
// REAL — el handler la distingue con `instanceof`, así que no puede ser un
// mock genérico) — solo se reemplazan las funciones que este route llama.
vi.mock("@/lib/db/repos/pixelforge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/repos/pixelforge")>();
  return {
    ...actual,
    getPixelforgeProjectFull: vi.fn(),
    getPixelforgeProject: vi.fn(),
    getLatestPageVersion: vi.fn(),
    getActiveQaRun: vi.fn(),
    createQaRun: vi.fn(),
    startQaRunPhase1: vi.fn(),
    insertQaFindings: vi.fn(),
    updateQaRunProgress: vi.fn(),
    failQaRun: vi.fn(),
    sweepStaleQaRuns: vi.fn(),
    listQaRunsForProject: vi.fn(),
  };
});

vi.mock("@/lib/pixelforge/qa/run-deterministic", () => ({ runDeterministicChecks: vi.fn() }));

import { POST, GET } from "./route";
import {
  getPixelforgeProjectFull,
  getPixelforgeProject,
  getLatestPageVersion,
  getActiveQaRun,
  createQaRun,
  startQaRunPhase1,
  insertQaFindings,
  updateQaRunProgress,
  failQaRun,
  sweepStaleQaRuns,
  listQaRunsForProject,
  QaRunAlreadyActiveError,
} from "@/lib/db/repos/pixelforge";
import { runDeterministicChecks } from "@/lib/pixelforge/qa/run-deterministic";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const QA_RUN_ID = "22222222-2222-2222-2222-222222222222";
const PAGE_VERSION_ID = "33333333-3333-3333-3333-333333333333";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/pixelforge/qa/runs", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function makeFull() {
  return {
    project: { id: PROJECT_ID, chosenDirectionId: null },
    artifacts: [],
    sources: [],
    events: [],
    visualReferences: [],
    assets: [],
    directions: [],
  };
}

/** Espera a que el fire-and-forget del POST (no awaiteado por el handler) drene sus microtasks/promesas mockeadas. */
async function flushBackground() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  // `resetAllMocks` (no solo `clearAllMocks`): `clearAllMocks` no limpia la
  // implementación que dejó un test anterior (`mockResolvedValue`/
  // `mockRejectedValue`/`mockImplementation`), solo el historial de
  // llamadas — sin esto, un test que deja p.ej. `getActiveQaRun` rechazando
  // o resuelto con otro valor se filtraba al siguiente test.
  vi.resetAllMocks();
  authMock.mockResolvedValue({ user: { id: "owner-1", name: "Miguel" } });
  (sweepStaleQaRuns as ReturnType<typeof vi.fn>).mockResolvedValue(0);
  (getActiveQaRun as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  (runDeterministicChecks as ReturnType<typeof vi.fn>).mockReturnValue({
    findings: [],
    checksSkipped: [],
    treeUsesCapabilities: false,
  });
});

describe("POST /api/pixelforge/qa/runs", () => {
  it("401 si no hay sesión", async () => {
    authMock.mockResolvedValue(null);

    const res = await POST(makeRequest({ projectId: PROJECT_ID }));

    expect(res.status).toBe(401);
  });

  it("400 si projectId no es un uuid", async () => {
    const res = await POST(makeRequest({ projectId: "no-es-un-uuid" }));
    expect(res.status).toBe(400);
  });

  it("404 si el proyecto no existe o no es del owner", async () => {
    (getPixelforgeProjectFull as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await POST(makeRequest({ projectId: PROJECT_ID }));

    expect(res.status).toBe(404);
  });

  it("409 si el proyecto no tiene ninguna versión compuesta", async () => {
    (getPixelforgeProjectFull as ReturnType<typeof vi.fn>).mockResolvedValue(makeFull());
    (getLatestPageVersion as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await POST(makeRequest({ projectId: PROJECT_ID }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/versión compuesta/);
    expect(createQaRun).not.toHaveBeenCalled();
  });

  it("409 si ya hay un QA activo (chequeo previo)", async () => {
    (getPixelforgeProjectFull as ReturnType<typeof vi.fn>).mockResolvedValue(makeFull());
    (getLatestPageVersion as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: PAGE_VERSION_ID,
      tree: { nodes: [], notas: "" },
    });
    (getActiveQaRun as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "otro-qa-run" });

    const res = await POST(makeRequest({ projectId: PROJECT_ID }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/Ya hay un QA activo/);
    expect(createQaRun).not.toHaveBeenCalled();
  });

  it("409 si la carrera la ataja el unique parcial (QaRunAlreadyActiveError de createQaRun)", async () => {
    (getPixelforgeProjectFull as ReturnType<typeof vi.fn>).mockResolvedValue(makeFull());
    (getLatestPageVersion as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: PAGE_VERSION_ID,
      tree: { nodes: [], notas: "" },
    });
    (getActiveQaRun as ReturnType<typeof vi.fn>).mockResolvedValue(null); // el chequeo previo no vio nada...
    (createQaRun as ReturnType<typeof vi.fn>).mockRejectedValue(new QaRunAlreadyActiveError()); // ...pero perdió la carrera contra el insert.

    const res = await POST(makeRequest({ projectId: PROJECT_ID }));

    expect(res.status).toBe(409);
  });

  it("happy path: crea el run, inserta los findings deterministas y marca progreso 35", async () => {
    (getPixelforgeProjectFull as ReturnType<typeof vi.fn>).mockResolvedValue(makeFull());
    const tree = { nodes: [], notas: "" };
    (getLatestPageVersion as ReturnType<typeof vi.fn>).mockResolvedValue({ id: PAGE_VERSION_ID, tree });
    (getActiveQaRun as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (createQaRun as ReturnType<typeof vi.fn>).mockResolvedValue({ id: QA_RUN_ID });
    const findings = [{ checkCode: "QA-ST-001" }];
    (runDeterministicChecks as ReturnType<typeof vi.fn>).mockReturnValue({
      findings,
      checksSkipped: [],
      treeUsesCapabilities: false,
    });

    const res = await POST(makeRequest({ projectId: PROJECT_ID }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ qaRunId: QA_RUN_ID, status: "running" });
    // `startQaRunPhase1` se AWAITEA antes de responder (no está en el
    // fire-and-forget) — la fila en DB ya dice 'running' cuando el cliente
    // recibe la respuesta, sin esperar a `flushBackground`.
    expect(startQaRunPhase1).toHaveBeenCalledWith(QA_RUN_ID);

    await flushBackground();

    expect(runDeterministicChecks).toHaveBeenCalledWith(
      expect.objectContaining({ tree, chosenDirection: null })
    );
    expect(insertQaFindings).toHaveBeenCalledWith(QA_RUN_ID, findings);
    expect(updateQaRunProgress).toHaveBeenCalledWith(QA_RUN_ID, 35, "navegador");
    expect(failQaRun).not.toHaveBeenCalled();
  });

  it("si startQaRunPhase1 lanza ANTES de responder, el catch externo hace best-effort failQaRun y devuelve 500", async () => {
    (getPixelforgeProjectFull as ReturnType<typeof vi.fn>).mockResolvedValue(makeFull());
    (getLatestPageVersion as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: PAGE_VERSION_ID,
      tree: { nodes: [], notas: "" },
    });
    (getActiveQaRun as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (createQaRun as ReturnType<typeof vi.fn>).mockResolvedValue({ id: QA_RUN_ID });
    (startQaRunPhase1 as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB caída"));

    const res = await POST(makeRequest({ projectId: PROJECT_ID }));

    expect(res.status).toBe(500);
    expect(failQaRun).toHaveBeenCalledWith(QA_RUN_ID, "internal", "Error inesperado");
    expect(runDeterministicChecks).not.toHaveBeenCalled();
  });

  it("una excepción en la fase 1 cierra el run vía failQaRun('internal'), nunca lo deja colgado", async () => {
    (getPixelforgeProjectFull as ReturnType<typeof vi.fn>).mockResolvedValue(makeFull());
    (getLatestPageVersion as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: PAGE_VERSION_ID,
      tree: { nodes: [], notas: "" },
    });
    (getActiveQaRun as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (createQaRun as ReturnType<typeof vi.fn>).mockResolvedValue({ id: QA_RUN_ID });
    (runDeterministicChecks as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("boom");
    });

    const res = await POST(makeRequest({ projectId: PROJECT_ID }));
    expect(res.status).toBe(200);

    await flushBackground();

    expect(failQaRun).toHaveBeenCalledWith(QA_RUN_ID, "internal", "boom");
  });
});

describe("GET /api/pixelforge/qa/runs", () => {
  it("401 si no hay sesión", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(new NextRequest(`http://localhost/api/pixelforge/qa/runs?projectId=${PROJECT_ID}`));
    expect(res.status).toBe(401);
  });

  it("404 si el proyecto no existe o no es del owner", async () => {
    (getPixelforgeProject as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await GET(new NextRequest(`http://localhost/api/pixelforge/qa/runs?projectId=${PROJECT_ID}`));
    expect(res.status).toBe(404);
  });

  it("barre stale runs y lista las corridas del proyecto", async () => {
    (getPixelforgeProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: PROJECT_ID });
    (listQaRunsForProject as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: QA_RUN_ID }]);

    const res = await GET(new NextRequest(`http://localhost/api/pixelforge/qa/runs?projectId=${PROJECT_ID}`));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(sweepStaleQaRuns).toHaveBeenCalledWith(PROJECT_ID);
    expect(body).toEqual({ runs: [{ id: QA_RUN_ID }] });
  });
});
