import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ auth: authMock }));

vi.mock("@/lib/db/repos/pixelforge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/repos/pixelforge")>();
  return {
    ...actual,
    getReviewWithComments: vi.fn(),
    resolveReviewComment: vi.fn(),
  };
});

import { POST } from "./route";
import { getReviewWithComments, resolveReviewComment, ReviewConflictError } from "@/lib/db/repos/pixelforge";

const OWNER_ID = "owner-1";
const REVIEW_ID = "22222222-2222-2222-2222-222222222222";
const OTHER_REVIEW_ID = "55555555-5555-5555-5555-555555555555";
const COMMENT_ID = "44444444-4444-4444-4444-444444444444";

function makeRequest(body: unknown) {
  return new NextRequest(
    `http://localhost/api/pixelforge/reviews/${REVIEW_ID}/comments/${COMMENT_ID}/resolution`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

function makeParams(reviewId: string = REVIEW_ID, commentId: string = COMMENT_ID) {
  return { params: Promise.resolve({ reviewId, commentId }) };
}

function makeReviewWithComments(comments = [{ id: COMMENT_ID, status: "open" }]) {
  return { review: { id: REVIEW_ID, status: "in_review" }, comments };
}

beforeEach(() => {
  vi.resetAllMocks();
  authMock.mockResolvedValue({ user: { id: OWNER_ID, name: "Miguel" } });
  (getReviewWithComments as ReturnType<typeof vi.fn>).mockResolvedValue(makeReviewWithComments());
});

describe("POST /api/pixelforge/reviews/:reviewId/comments/:commentId/resolution", () => {
  it("401 si no hay sesión", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(makeRequest({ finalStatus: "resolved", reason: "se corrigió" }), makeParams());
    expect(res.status).toBe(401);
  });

  it("400 si reviewId no es un uuid", async () => {
    const res = await POST(
      makeRequest({ finalStatus: "resolved", reason: "se corrigió" }),
      makeParams("no-es-un-uuid")
    );
    expect(res.status).toBe(400);
  });

  it("400 si commentId no es un uuid", async () => {
    const res = await POST(
      makeRequest({ finalStatus: "resolved", reason: "se corrigió" }),
      makeParams(REVIEW_ID, "no-es-un-uuid")
    );
    expect(res.status).toBe(400);
  });

  it("400 si finalStatus no es 'resolved'/'dismissed'", async () => {
    const res = await POST(makeRequest({ finalStatus: "otro", reason: "se corrigió" }), makeParams());
    expect(res.status).toBe(400);
  });

  it("400 si la razón es demasiado corta", async () => {
    const res = await POST(makeRequest({ finalStatus: "resolved", reason: "ok" }), makeParams());
    expect(res.status).toBe(400);
    expect(resolveReviewComment).not.toHaveBeenCalled();
  });

  it("404 si la revisión no existe o no es del owner", async () => {
    (getReviewWithComments as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await POST(makeRequest({ finalStatus: "resolved", reason: "se corrigió" }), makeParams());
    expect(res.status).toBe(404);
    expect(resolveReviewComment).not.toHaveBeenCalled();
  });

  it("404 si el commentId no pertenece a la revisión del path (URLs cruzadas)", async () => {
    (getReviewWithComments as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeReviewWithComments([{ id: "otro-comentario", status: "open" }])
    );
    const res = await POST(
      makeRequest({ finalStatus: "resolved", reason: "se corrigió" }),
      makeParams(OTHER_REVIEW_ID, COMMENT_ID)
    );
    expect(res.status).toBe(404);
    expect(resolveReviewComment).not.toHaveBeenCalled();
  });

  it("409 si el CAS pierde (el comentario ya no está abierto)", async () => {
    (resolveReviewComment as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ReviewConflictError("El comentario ya no está abierto")
    );
    const res = await POST(makeRequest({ finalStatus: "resolved", reason: "se corrigió" }), makeParams());
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.error).toMatch(/ya no está abierto/);
  });

  it("200 feliz: resuelve el comentario con el actor de la sesión (nunca del body)", async () => {
    (resolveReviewComment as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const res = await POST(
      makeRequest({
        finalStatus: "dismissed",
        reason: "no aplica en este contexto",
        evidence: { url: "https://x" },
        resolvedById: "otro-owner-inyectado",
      }),
      makeParams()
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(resolveReviewComment).toHaveBeenCalledWith(
      COMMENT_ID,
      OWNER_ID,
      { finalStatus: "dismissed", reason: "no aplica en este contexto", evidence: { url: "https://x" } },
      { id: OWNER_ID, name: "Miguel" }
    );
  });
});
