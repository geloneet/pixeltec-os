import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ auth: authMock }));

vi.mock("@/lib/db/repos/pixelforge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/repos/pixelforge")>();
  return {
    ...actual,
    addReviewComment: vi.fn(),
  };
});

import { POST } from "./route";
import { addReviewComment } from "@/lib/db/repos/pixelforge";

const OWNER_ID = "owner-1";
const REVIEW_ID = "22222222-2222-2222-2222-222222222222";
const FINDING_ID = "33333333-3333-3333-3333-333333333333";
const COMMENT_ID = "44444444-4444-4444-4444-444444444444";

function makeRequest(body: unknown) {
  return new NextRequest(`http://localhost/api/pixelforge/reviews/${REVIEW_ID}/comments`, {
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

describe("POST /api/pixelforge/reviews/:reviewId/comments", () => {
  it("401 si no hay sesión", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(
      makeRequest({ anchorType: "general", body: "un comentario", blocking: false }),
      makeParams()
    );
    expect(res.status).toBe(401);
  });

  it("400 si reviewId no es un uuid", async () => {
    const res = await POST(
      makeRequest({ anchorType: "general", body: "un comentario", blocking: false }),
      makeParams("no-es-un-uuid")
    );
    expect(res.status).toBe(400);
    expect(addReviewComment).not.toHaveBeenCalled();
  });

  it("400 si el body está vacío", async () => {
    const res = await POST(makeRequest({ anchorType: "general", body: "", blocking: false }), makeParams());
    expect(res.status).toBe(400);
  });

  it("400 si el body excede 2000 caracteres", async () => {
    const res = await POST(
      makeRequest({ anchorType: "general", body: "x".repeat(2001), blocking: false }),
      makeParams()
    );
    expect(res.status).toBe(400);
  });

  it("400 (superRefine): anchorType 'section' sin nodeId", async () => {
    const res = await POST(
      makeRequest({ anchorType: "section", body: "falta nodeId", blocking: false }),
      makeParams()
    );
    expect(res.status).toBe(400);
    expect(addReviewComment).not.toHaveBeenCalled();
  });

  it("400 (superRefine): anchorType 'section' con findingId prohibido", async () => {
    const res = await POST(
      makeRequest({ anchorType: "section", nodeId: "hero-1", findingId: FINDING_ID, body: "no debería", blocking: false }),
      makeParams()
    );
    expect(res.status).toBe(400);
  });

  it("400 (superRefine): anchorType 'finding' sin findingId", async () => {
    const res = await POST(
      makeRequest({ anchorType: "finding", body: "falta findingId", blocking: false }),
      makeParams()
    );
    expect(res.status).toBe(400);
  });

  it("400 (superRefine): anchorType 'finding' con nodeId prohibido", async () => {
    const res = await POST(
      makeRequest({ anchorType: "finding", findingId: FINDING_ID, nodeId: "hero-1", body: "no debería", blocking: false }),
      makeParams()
    );
    expect(res.status).toBe(400);
  });

  it("400 (superRefine): anchorType 'general' con nodeId prohibido", async () => {
    const res = await POST(
      makeRequest({ anchorType: "general", nodeId: "hero-1", body: "no debería", blocking: false }),
      makeParams()
    );
    expect(res.status).toBe(400);
  });

  it("400 (superRefine): anchorType 'general' con findingId prohibido", async () => {
    const res = await POST(
      makeRequest({ anchorType: "general", findingId: FINDING_ID, body: "no debería", blocking: false }),
      makeParams()
    );
    expect(res.status).toBe(400);
  });

  it("404 si la revisión no existe o no es del owner", async () => {
    (addReviewComment as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Revisión no encontrada"));
    const res = await POST(
      makeRequest({ anchorType: "general", body: "un comentario", blocking: false }),
      makeParams()
    );
    expect(res.status).toBe(404);
  });

  it("409 si la revisión ya no está abierta", async () => {
    (addReviewComment as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Solo se puede comentar en una revisión abierta")
    );
    const res = await POST(
      makeRequest({ anchorType: "general", body: "un comentario", blocking: false }),
      makeParams()
    );
    expect(res.status).toBe(409);
  });

  it("409 si el nodeId no existe en el árbol anclado", async () => {
    (addReviewComment as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('El nodo "hero-x" no existe en la versión anclada')
    );
    const res = await POST(
      makeRequest({ anchorType: "section", nodeId: "hero-x", body: "comentario", blocking: false }),
      makeParams()
    );
    expect(res.status).toBe(409);
  });

  it("200 feliz: agrega el comentario con el actor de la sesión (nunca del body)", async () => {
    const comment = { id: COMMENT_ID, anchorType: "general" };
    (addReviewComment as ReturnType<typeof vi.fn>).mockResolvedValue(comment);

    const res = await POST(
      makeRequest({
        anchorType: "general",
        body: "un comentario",
        blocking: true,
        authorId: "otro-owner-inyectado",
      }),
      makeParams()
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, comment });
    expect(addReviewComment).toHaveBeenCalledWith(
      REVIEW_ID,
      OWNER_ID,
      { anchorType: "general", nodeId: undefined, findingId: undefined, body: "un comentario", blocking: true },
      { id: OWNER_ID, name: "Miguel" }
    );
  });
});
