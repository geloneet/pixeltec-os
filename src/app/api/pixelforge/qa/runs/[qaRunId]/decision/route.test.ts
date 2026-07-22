import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ auth: authMock }));

vi.mock("@/lib/db/repos/pixelforge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/repos/pixelforge")>();
  return {
    ...actual,
    getQaRunWithFindings: vi.fn(),
    getLatestPageVersion: vi.fn(),
    recordQaHumanDecision: vi.fn(),
    openQaGate: vi.fn(),
  };
});

import { POST } from "./route";
import {
  getQaRunWithFindings,
  getLatestPageVersion,
  recordQaHumanDecision,
  openQaGate,
} from "@/lib/db/repos/pixelforge";

const OWNER_ID = "owner-1";
const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const QA_RUN_ID = "22222222-2222-2222-2222-222222222222";
const PAGE_VERSION_ID = "33333333-3333-3333-3333-333333333333";

function makeRequest(body: unknown) {
  return new NextRequest(`http://localhost/api/pixelforge/qa/runs/${QA_RUN_ID}/decision`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function makeParams() {
  return { params: Promise.resolve({ qaRunId: QA_RUN_ID }) };
}

function makeExisting(overrides: Partial<{ pageVersionId: string }> = {}) {
  return {
    run: { id: QA_RUN_ID, projectId: PROJECT_ID, pageVersionId: PAGE_VERSION_ID, ...overrides },
    findings: [],
  };
}

beforeEach(() => {
  // `resetAllMocks` (no solo `clearAllMocks`) — `clearAllMocks` NO limpia la
  // implementación (`mockResolvedValue`/`mockRejectedValue`) que dejó un test
  // anterior, solo el historial de llamadas; sin esto, un test que deja
  // `recordQaHumanDecision` rechazando se filtraba a los tests siguientes.
  vi.resetAllMocks();
  authMock.mockResolvedValue({ user: { id: OWNER_ID, name: "Miguel" } });
  (getQaRunWithFindings as ReturnType<typeof vi.fn>).mockResolvedValue(makeExisting());
  (getLatestPageVersion as ReturnType<typeof vi.fn>).mockResolvedValue({ id: PAGE_VERSION_ID });
  // Default: el gate SIEMPRE abre — mismo shape que devuelve el repo real
  // desde que `openQaGate` pasó de `Promise<void>` a `Promise<OpenQaGateResult>`
  // (review final PF-F8, finding 1). El test de la carrera lo pisa.
  (openQaGate as ReturnType<typeof vi.fn>).mockResolvedValue({ opened: true });
});

describe("POST /api/pixelforge/qa/runs/:qaRunId/decision", () => {
  it("401 si no hay sesión", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(makeRequest({ decision: "approved", reason: "se ve bien" }), makeParams());
    expect(res.status).toBe(401);
  });

  it("400 si la razón es demasiado corta", async () => {
    const res = await POST(makeRequest({ decision: "approved", reason: "ok" }), makeParams());
    expect(res.status).toBe(400);
    expect(recordQaHumanDecision).not.toHaveBeenCalled();
  });

  it("400 si decision no es 'approved'/'rejected'", async () => {
    const res = await POST(makeRequest({ decision: "maybe", reason: "razón suficiente" }), makeParams());
    expect(res.status).toBe(400);
  });

  it("404 si el QA no existe o no es del owner", async () => {
    (getQaRunWithFindings as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await POST(makeRequest({ decision: "approved", reason: "razón suficiente" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("409 si la versión evaluada ya no es la vigente", async () => {
    (getLatestPageVersion as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "otra-version-mas-nueva" });

    const res = await POST(makeRequest({ decision: "approved", reason: "razón suficiente" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/versión anterior/);
    expect(recordQaHumanDecision).not.toHaveBeenCalled();
  });

  it("409 si el run no admite decisión humana (p.ej. verdict='fail', T1 lo rechaza)", async () => {
    (recordQaHumanDecision as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Este QA no admite una decisión humana — debe estar succeeded con verdict pass_with_warnings y sin decisión previa")
    );

    const res = await POST(makeRequest({ decision: "approved", reason: "razón suficiente" }), makeParams());

    expect(res.status).toBe(409);
    expect(openQaGate).not.toHaveBeenCalled();
  });

  it("approved → registra la decisión y abre la compuerta (openQaGate)", async () => {
    const res = await POST(makeRequest({ decision: "approved", reason: "razón suficiente" }), makeParams());

    expect(res.status).toBe(200);
    expect(recordQaHumanDecision).toHaveBeenCalledWith(QA_RUN_ID, OWNER_ID, "approved", "razón suficiente", {
      id: OWNER_ID,
      name: "Miguel",
    });
    expect(openQaGate).toHaveBeenCalledWith(PROJECT_ID, QA_RUN_ID, { id: OWNER_ID, name: "Miguel" });
  });

  it("409 si openQaGate detecta stale-version DENTRO de su tx pese al chequeo temprano (review final PF-F8, finding 1)", async () => {
    // El chequeo temprano de arriba (línea `getLatestPageVersion`) es UX, no
    // la garantía — simula la carrera real: una versión nueva aterriza justo
    // DESPUÉS de ese chequeo pero ANTES de la tx de openQaGate.
    (openQaGate as ReturnType<typeof vi.fn>).mockResolvedValue({ opened: false, reason: "stale-version" });

    const res = await POST(makeRequest({ decision: "approved", reason: "razón suficiente" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/versión anterior/);
    // La decisión humana YA se registró (sigue siendo un hecho real) — lo
    // que no ocurrió fue el avance de estación.
    expect(recordQaHumanDecision).toHaveBeenCalled();
  });

  it("rejected → registra la decisión y NO abre la compuerta", async () => {
    const res = await POST(makeRequest({ decision: "rejected", reason: "no cumple con la marca" }), makeParams());

    expect(res.status).toBe(200);
    expect(recordQaHumanDecision).toHaveBeenCalledWith(
      QA_RUN_ID,
      OWNER_ID,
      "rejected",
      "no cumple con la marca",
      { id: OWNER_ID, name: "Miguel" }
    );
    expect(openQaGate).not.toHaveBeenCalled();
  });
});
