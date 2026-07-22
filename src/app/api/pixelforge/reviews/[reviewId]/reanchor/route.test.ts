import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ auth: authMock }));

vi.mock("@/lib/db/repos/pixelforge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/repos/pixelforge")>();
  return {
    ...actual,
    reanchorReview: vi.fn(),
  };
});

import { POST } from "./route";
import { reanchorReview, ReviewConflictError } from "@/lib/db/repos/pixelforge";

const OWNER_ID = "owner-1";
const REVIEW_ID = "22222222-2222-2222-2222-222222222222";

function makeRequest() {
  return new NextRequest(`http://localhost/api/pixelforge/reviews/${REVIEW_ID}/reanchor`, {
    method: "POST",
  });
}

function makeParams(reviewId: string = REVIEW_ID) {
  return { params: Promise.resolve({ reviewId }) };
}

beforeEach(() => {
  vi.resetAllMocks();
  authMock.mockResolvedValue({ user: { id: OWNER_ID, name: "Miguel" } });
});

describe("POST /api/pixelforge/reviews/:reviewId/reanchor", () => {
  it("401 si no hay sesión", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it("400 si reviewId no es un uuid", async () => {
    const res = await POST(makeRequest(), makeParams("no-es-un-uuid"));
    expect(res.status).toBe(400);
    expect(reanchorReview).not.toHaveBeenCalled();
  });

  it("404 si la revisión no existe o no es del owner", async () => {
    (reanchorReview as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Revisión no encontrada"));
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("409 si la revisión no está abierta", async () => {
    (reanchorReview as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("La revisión no está abierta"));
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(409);
  });

  it("409 si no hay un QA cerrado más reciente que abra la compuerta", async () => {
    (reanchorReview as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("El QA más reciente no abre la compuerta; re-ejecuta QA o solicita cambios")
    );
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(409);
  });

  it("409 si el CAS pierde (ReviewConflictError)", async () => {
    (reanchorReview as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ReviewConflictError("La revisión ya no está abierta")
    );
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(409);
  });

  it("200 feliz: re-ancla con el actor de la sesión", async () => {
    (reanchorReview as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const res = await POST(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(reanchorReview).toHaveBeenCalledWith(REVIEW_ID, OWNER_ID, { id: OWNER_ID, name: "Miguel" });
  });
});
