import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ auth: authMock }));

vi.mock("@/lib/db/repos/pixelforge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/repos/pixelforge")>();
  return {
    ...actual,
    getReviewWithComments: vi.fn(),
  };
});

import { GET } from "./route";
import { getReviewWithComments } from "@/lib/db/repos/pixelforge";

const OWNER_ID = "owner-1";
const REVIEW_ID = "22222222-2222-2222-2222-222222222222";

function makeRequest() {
  return new NextRequest(`http://localhost/api/pixelforge/reviews/${REVIEW_ID}`);
}

function makeParams(reviewId: string = REVIEW_ID) {
  return { params: Promise.resolve({ reviewId }) };
}

beforeEach(() => {
  vi.resetAllMocks();
  authMock.mockResolvedValue({ user: { id: OWNER_ID, name: "Miguel" } });
});

describe("GET /api/pixelforge/reviews/:reviewId", () => {
  it("401 si no hay sesión", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it("400 si reviewId no es un uuid", async () => {
    const res = await GET(makeRequest(), makeParams("no-es-un-uuid"));
    expect(res.status).toBe(400);
    expect(getReviewWithComments).not.toHaveBeenCalled();
  });

  it("404 si la revisión no existe o no es del owner", async () => {
    (getReviewWithComments as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("200: devuelve review + comments", async () => {
    const review = { id: REVIEW_ID, status: "in_review" };
    const comments = [{ id: "comentario-1" }];
    (getReviewWithComments as ReturnType<typeof vi.fn>).mockResolvedValue({ review, comments });

    const res = await GET(makeRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ review, comments });
    expect(getReviewWithComments).toHaveBeenCalledWith(REVIEW_ID, OWNER_ID);
  });
});
