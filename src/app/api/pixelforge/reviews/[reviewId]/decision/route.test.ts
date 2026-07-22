import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ auth: authMock }));

vi.mock("@/lib/db/repos/pixelforge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/repos/pixelforge")>();
  return {
    ...actual,
    approveReview: vi.fn(),
    requestChanges: vi.fn(),
    cancelReview: vi.fn(),
  };
});

import { POST } from "./route";
import {
  approveReview,
  requestChanges,
  cancelReview,
  ReviewNotFoundError,
  ReviewRuleError,
  ReviewConflictError,
} from "@/lib/db/repos/pixelforge";

const OWNER_ID = "owner-1";
const REVIEW_ID = "22222222-2222-2222-2222-222222222222";
const FINDING_ID = "33333333-3333-3333-3333-333333333333";

function makeRequest(body: unknown) {
  return new NextRequest(`http://localhost/api/pixelforge/reviews/${REVIEW_ID}/decision`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function makeParams(reviewId: string = REVIEW_ID) {
  return { params: Promise.resolve({ reviewId }) };
}

beforeEach(() => {
  vi.resetAllMocks();
  authMock.mockResolvedValue({ user: { id: OWNER_ID, name: "Miguel" } });
});

describe("POST /api/pixelforge/reviews/:reviewId/decision", () => {
  it("401 si no hay sesión", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(makeRequest({ action: "cancel", reason: "ya no aplica" }), makeParams());
    expect(res.status).toBe(401);
  });

  it("400 si reviewId no es un uuid", async () => {
    const res = await POST(
      makeRequest({ action: "cancel", reason: "ya no aplica" }),
      makeParams("no-es-un-uuid")
    );
    expect(res.status).toBe(400);
  });

  it("400 si action es desconocida", async () => {
    const res = await POST(makeRequest({ action: "algo_raro", reason: "ya no aplica" }), makeParams());
    expect(res.status).toBe(400);
  });

  it("400 si falta el discriminador action", async () => {
    const res = await POST(makeRequest({ reason: "ya no aplica" }), makeParams());
    expect(res.status).toBe(400);
  });

  describe("action=approve", () => {
    it("400 si reason es demasiado corta", async () => {
      const res = await POST(makeRequest({ action: "approve", reason: "ok" }), makeParams());
      expect(res.status).toBe(400);
      expect(approveReview).not.toHaveBeenCalled();
    });

    it("400 si reason es solo espacios en blanco (whitespace-only)", async () => {
      const res = await POST(makeRequest({ action: "approve", reason: "     " }), makeParams());
      expect(res.status).toBe(400);
      expect(approveReview).not.toHaveBeenCalled();
    });

    it("400 si un risk trae rationale demasiado corta", async () => {
      const res = await POST(
        makeRequest({
          action: "approve",
          reason: "se acepta el riesgo menor",
          risks: [{ findingId: FINDING_ID, rationale: "ok" }],
        }),
        makeParams()
      );
      expect(res.status).toBe(400);
    });

    it("400 si un risk trae rationale que es solo espacios en blanco (whitespace-only)", async () => {
      const res = await POST(
        makeRequest({
          action: "approve",
          reason: "se acepta el riesgo menor",
          risks: [{ findingId: FINDING_ID, rationale: "     " }],
        }),
        makeParams()
      );
      expect(res.status).toBe(400);
      expect(approveReview).not.toHaveBeenCalled();
    });

    it("400 si un risk trae findingId no-uuid", async () => {
      const res = await POST(
        makeRequest({
          action: "approve",
          reason: "se acepta el riesgo menor",
          risks: [{ findingId: "no-es-un-uuid", rationale: "razón suficiente" }],
        }),
        makeParams()
      );
      expect(res.status).toBe(400);
    });

    it("404 si la revisión no existe o no es del owner", async () => {
      (approveReview as ReturnType<typeof vi.fn>).mockRejectedValue(new ReviewNotFoundError("Revisión no encontrada"));
      const res = await POST(makeRequest({ action: "approve", reason: "se ve bien" }), makeParams());
      expect(res.status).toBe(404);
    });

    it("409 si quedan comentarios bloqueantes abiertos", async () => {
      (approveReview as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ReviewRuleError("No se puede aprobar: quedan 2 comentario(s) bloqueante(s) sin resolver")
      );
      const res = await POST(makeRequest({ action: "approve", reason: "se ve bien" }), makeParams());
      const body = await res.json();
      expect(res.status).toBe(409);
      expect(body.error).toMatch(/bloqueante/);
    });

    it("409 si riesgos aceptados son inválidos", async () => {
      (approveReview as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ReviewRuleError("El finding no existe en el QA anclado")
      );
      const res = await POST(makeRequest({ action: "approve", reason: "se ve bien" }), makeParams());
      expect(res.status).toBe(409);
    });

    it("409 si el CAS pierde (ReviewConflictError)", async () => {
      (approveReview as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ReviewConflictError("La revisión ya no está abierta")
      );
      const res = await POST(makeRequest({ action: "approve", reason: "se ve bien" }), makeParams());
      expect(res.status).toBe(409);
    });

    it("500 sin filtrar el mensaje si approveReview lanza un error no reconocido", async () => {
      (approveReview as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("detalle interno de postgres"));
      const res = await POST(makeRequest({ action: "approve", reason: "se ve bien" }), makeParams());
      const body = await res.json();
      expect(res.status).toBe(500);
      expect(body.error).toBe("Error inesperado");
      expect(JSON.stringify(body)).not.toMatch(/detalle interno/);
    });

    it("200 feliz: risks default [] y actor de la sesión (nunca del body)", async () => {
      (approveReview as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const res = await POST(
        makeRequest({ action: "approve", reason: "se ve bien", approvedById: "otro-owner-inyectado" }),
        makeParams()
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({ ok: true });
      expect(approveReview).toHaveBeenCalledWith(
        REVIEW_ID,
        OWNER_ID,
        { reason: "se ve bien", risks: [] },
        { id: OWNER_ID, name: "Miguel" }
      );
    });

    it("200 feliz con risks explícitos", async () => {
      (approveReview as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      const risks = [{ findingId: FINDING_ID, rationale: "riesgo menor, aceptado" }];

      const res = await POST(
        makeRequest({ action: "approve", reason: "se ve bien", risks }),
        makeParams()
      );

      expect(res.status).toBe(200);
      expect(approveReview).toHaveBeenCalledWith(
        REVIEW_ID,
        OWNER_ID,
        { reason: "se ve bien", risks },
        { id: OWNER_ID, name: "Miguel" }
      );
    });
  });

  describe("action=request_changes", () => {
    it("400 si changeKind no es válido", async () => {
      const res = await POST(
        makeRequest({ action: "request_changes", changeKind: "algo_raro", reason: "hay que ajustar" }),
        makeParams()
      );
      expect(res.status).toBe(400);
      expect(requestChanges).not.toHaveBeenCalled();
    });

    it("400 si reason es demasiado corta", async () => {
      const res = await POST(
        makeRequest({ action: "request_changes", changeKind: "estructura", reason: "no" }),
        makeParams()
      );
      expect(res.status).toBe(400);
    });

    it("400 si reason es solo espacios en blanco (whitespace-only)", async () => {
      const res = await POST(
        makeRequest({ action: "request_changes", changeKind: "estructura", reason: "     " }),
        makeParams()
      );
      expect(res.status).toBe(400);
      expect(requestChanges).not.toHaveBeenCalled();
    });

    it("404 si la revisión no existe o no es del owner", async () => {
      (requestChanges as ReturnType<typeof vi.fn>).mockRejectedValue(new ReviewNotFoundError("Revisión no encontrada"));
      const res = await POST(
        makeRequest({ action: "request_changes", changeKind: "estructura", reason: "hay que ajustar" }),
        makeParams()
      );
      expect(res.status).toBe(404);
    });

    it("409 si contentTarget falta para changeKind='contenido'", async () => {
      (requestChanges as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ReviewRuleError("resolveChangeTarget: el cambio de tipo 'contenido' requiere `contentTarget`")
      );
      const res = await POST(
        makeRequest({ action: "request_changes", changeKind: "contenido", reason: "hay que ajustar" }),
        makeParams()
      );
      expect(res.status).toBe(409);
    });

    it("409 si el CAS pierde (ReviewConflictError)", async () => {
      (requestChanges as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ReviewConflictError("La revisión ya no está abierta")
      );
      const res = await POST(
        makeRequest({ action: "request_changes", changeKind: "estructura", reason: "hay que ajustar" }),
        makeParams()
      );
      expect(res.status).toBe(409);
    });

    it("500 sin filtrar el mensaje si requestChanges lanza un error no reconocido", async () => {
      (requestChanges as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("detalle interno de postgres"));
      const res = await POST(
        makeRequest({ action: "request_changes", changeKind: "estructura", reason: "hay que ajustar" }),
        makeParams()
      );
      const body = await res.json();
      expect(res.status).toBe(500);
      expect(body.error).toBe("Error inesperado");
      expect(JSON.stringify(body)).not.toMatch(/detalle interno/);
    });

    it("200 feliz: pasa changeKind/contentTarget/reason y el actor de la sesión", async () => {
      (requestChanges as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const res = await POST(
        makeRequest({
          action: "request_changes",
          changeKind: "contenido",
          contentTarget: "estrategia",
          reason: "hay que ajustar el mensaje principal",
        }),
        makeParams()
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({ ok: true });
      expect(requestChanges).toHaveBeenCalledWith(
        REVIEW_ID,
        OWNER_ID,
        { changeKind: "contenido", contentTarget: "estrategia", reason: "hay que ajustar el mensaje principal" },
        { id: OWNER_ID, name: "Miguel" }
      );
    });
  });

  describe("action=cancel", () => {
    it("400 si reason es demasiado corta", async () => {
      const res = await POST(makeRequest({ action: "cancel", reason: "no" }), makeParams());
      expect(res.status).toBe(400);
      expect(cancelReview).not.toHaveBeenCalled();
    });

    it("400 si reason es solo espacios en blanco (whitespace-only)", async () => {
      const res = await POST(makeRequest({ action: "cancel", reason: "     " }), makeParams());
      expect(res.status).toBe(400);
      expect(cancelReview).not.toHaveBeenCalled();
    });

    it("404 si la revisión no existe o no es del owner", async () => {
      (cancelReview as ReturnType<typeof vi.fn>).mockRejectedValue(new ReviewNotFoundError("Revisión no encontrada"));
      const res = await POST(makeRequest({ action: "cancel", reason: "ya no aplica" }), makeParams());
      expect(res.status).toBe(404);
    });

    it("409 si el CAS pierde (ReviewConflictError)", async () => {
      (cancelReview as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ReviewConflictError("La revisión ya no está abierta")
      );
      const res = await POST(makeRequest({ action: "cancel", reason: "ya no aplica" }), makeParams());
      expect(res.status).toBe(409);
    });

    it("500 sin filtrar el mensaje si cancelReview lanza un error no reconocido", async () => {
      (cancelReview as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("detalle interno de postgres"));
      const res = await POST(makeRequest({ action: "cancel", reason: "ya no aplica" }), makeParams());
      const body = await res.json();
      expect(res.status).toBe(500);
      expect(body.error).toBe("Error inesperado");
      expect(JSON.stringify(body)).not.toMatch(/detalle interno/);
    });

    it("200 feliz: cancela con el actor de la sesión (nunca del body)", async () => {
      (cancelReview as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const res = await POST(
        makeRequest({ action: "cancel", reason: "ya no aplica", cancelledById: "otro-owner-inyectado" }),
        makeParams()
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({ ok: true });
      expect(cancelReview).toHaveBeenCalledWith(
        REVIEW_ID,
        OWNER_ID,
        "ya no aplica",
        { id: OWNER_ID, name: "Miguel" }
      );
    });
  });
});
