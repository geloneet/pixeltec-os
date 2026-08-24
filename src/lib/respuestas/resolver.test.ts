import { beforeEach, describe, expect, test, vi } from "vitest";

const { getSmilemoreQaResponseMock } = vi.hoisted(() => ({
  getSmilemoreQaResponseMock: vi.fn(),
}));
vi.mock("@/lib/smilemore-qa-repo", () => ({
  getSmilemoreQaResponse: getSmilemoreQaResponseMock,
}));

import { resolveRespuesta, smilemoreQaResolver, type RespuestaResolver } from "./resolver";

const ID = "3f2c1b6a-0d1e-4a7b-9c8d-5e6f7a8b9c0d";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveRespuesta — /respuestas/[id] (D-22)", () => {
  test("respuesta existente de Smile More → redirect a /smilemore-respuestas/[id]", async () => {
    getSmilemoreQaResponseMock.mockResolvedValue({ id: ID });
    await expect(resolveRespuesta(ID)).resolves.toEqual({
      kind: "redirect",
      href: `/smilemore-respuestas/${ID}`,
      source: "smilemore_qa",
    });
    expect(getSmilemoreQaResponseMock).toHaveBeenCalledWith(ID);
  });

  test("uuid válido pero inexistente → not-found (404), sin redirect ambiguo", async () => {
    getSmilemoreQaResponseMock.mockResolvedValue(null);
    await expect(resolveRespuesta(ID)).resolves.toEqual({ kind: "not-found" });
  });

  test("id malformado → not-found sin tocar la DB", async () => {
    for (const bad of ["", "   ", "abc", "../hoy", "x".repeat(200)]) {
      await expect(resolveRespuesta(bad)).resolves.toEqual({ kind: "not-found" });
    }
    expect(getSmilemoreQaResponseMock).not.toHaveBeenCalled();
  });

  test("extensible: un resolver nuevo (p. ej. Encino) se antepone sin cambiar la URL pública", async () => {
    getSmilemoreQaResponseMock.mockResolvedValue(null);
    const encino: RespuestaResolver = {
      source: "encino_prospectos",
      resolve: async (id) => (id === "encino-lead-42" ? "/encino-prospectos/42" : null),
    };
    await expect(resolveRespuesta("encino-lead-42", [smilemoreQaResolver, encino])).resolves.toEqual({
      kind: "redirect",
      href: "/encino-prospectos/42",
      source: "encino_prospectos",
    });
    await expect(resolveRespuesta("otro", [smilemoreQaResolver, encino])).resolves.toEqual({
      kind: "not-found",
    });
  });
});
