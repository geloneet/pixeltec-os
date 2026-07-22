import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ auth: authMock }));

vi.mock("@/lib/db/repos/pixelforge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/repos/pixelforge")>();
  return {
    ...actual,
    openReview: vi.fn(),
    listReviewsForProject: vi.fn(),
  };
});

import { POST, GET } from "./route";
import {
  openReview,
  listReviewsForProject,
  ReviewNotFoundError,
  ReviewRuleError,
} from "@/lib/db/repos/pixelforge";

const OWNER_ID = "owner-1";
const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const REVIEW_ID = "22222222-2222-2222-2222-222222222222";

function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/pixelforge/reviews", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function makeGetRequest(projectId: string | null) {
  const url = new URL("http://localhost/api/pixelforge/reviews");
  if (projectId !== null) url.searchParams.set("projectId", projectId);
  return new NextRequest(url);
}

beforeEach(() => {
  vi.resetAllMocks();
  authMock.mockResolvedValue({ user: { id: OWNER_ID, name: "Miguel" } });
});

describe("POST /api/pixelforge/reviews", () => {
  it("401 si no hay sesión", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(makePostRequest({ projectId: PROJECT_ID }));
    expect(res.status).toBe(401);
  });

  it("400 si projectId no es un uuid", async () => {
    const res = await POST(makePostRequest({ projectId: "no-es-un-uuid" }));
    expect(res.status).toBe(400);
    expect(openReview).not.toHaveBeenCalled();
  });

  it("404 si el proyecto no es del owner (openReview lanza ReviewNotFoundError)", async () => {
    (openReview as ReturnType<typeof vi.fn>).mockRejectedValue(new ReviewNotFoundError("Proyecto no encontrado"));
    const res = await POST(makePostRequest({ projectId: PROJECT_ID }));
    expect(res.status).toBe(404);
  });

  it("409 si el gate de QA no está abierto (ReviewRuleError)", async () => {
    (openReview as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ReviewRuleError("La versión vigente todavía no pasó QA; no se puede abrir revisión.")
    );
    const res = await POST(makePostRequest({ projectId: PROJECT_ID }));
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.error).toMatch(/no pasó QA/);
  });

  it("409 si ya hay una revisión activa (ReviewRuleError)", async () => {
    (openReview as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ReviewRuleError("Ya hay una revisión activa para este proyecto")
    );
    const res = await POST(makePostRequest({ projectId: PROJECT_ID }));
    expect(res.status).toBe(409);
  });

  it("500 sin filtrar el mensaje si openReview lanza un error no reconocido", async () => {
    (openReview as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("detalle interno de postgres"));
    const res = await POST(makePostRequest({ projectId: PROJECT_ID }));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe("Error inesperado");
    expect(JSON.stringify(body)).not.toMatch(/detalle interno/);
  });

  it("200 feliz: abre la revisión con el actor de la sesión (nunca del body)", async () => {
    const review = { id: REVIEW_ID, projectId: PROJECT_ID, status: "in_review" };
    (openReview as ReturnType<typeof vi.fn>).mockResolvedValue(review);

    const res = await POST(
      makePostRequest({ projectId: PROJECT_ID, ownerId: "otro-owner-inyectado" })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, review });
    expect(openReview).toHaveBeenCalledWith(PROJECT_ID, OWNER_ID, { id: OWNER_ID, name: "Miguel" });
  });
});

describe("GET /api/pixelforge/reviews", () => {
  it("401 si no hay sesión", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(makeGetRequest(PROJECT_ID));
    expect(res.status).toBe(401);
  });

  it("400 sin projectId válido", async () => {
    const res = await GET(makeGetRequest("no-es-un-uuid"));
    expect(res.status).toBe(400);
  });

  it("404 si el proyecto no es del owner (listReviewsForProject lanza ReviewNotFoundError)", async () => {
    (listReviewsForProject as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ReviewNotFoundError("Proyecto no encontrado")
    );
    const res = await GET(makeGetRequest(PROJECT_ID));
    expect(res.status).toBe(404);
  });

  it("500 sin filtrar el mensaje si listReviewsForProject lanza un error no reconocido", async () => {
    (listReviewsForProject as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("detalle interno de postgres"));
    const res = await GET(makeGetRequest(PROJECT_ID));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe("Error inesperado");
    expect(JSON.stringify(body)).not.toMatch(/detalle interno/);
  });

  it("200: lista las revisiones del proyecto", async () => {
    const reviews = [{ id: REVIEW_ID }];
    (listReviewsForProject as ReturnType<typeof vi.fn>).mockResolvedValue(reviews);

    const res = await GET(makeGetRequest(PROJECT_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ reviews });
    expect(listReviewsForProject).toHaveBeenCalledWith(PROJECT_ID, OWNER_ID);
  });
});
