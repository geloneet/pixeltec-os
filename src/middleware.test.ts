import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * `middleware.ts` importa `@/lib/auth/config`, que arrastra `@/lib/db` (abre
 * un cliente Postgres al evaluarse el módulo) — mismo criterio que
 * `src/app/api/pixelforge/qa/runs/route.test.ts`: se mockea `auth` para
 * poder importar el módulo bajo Vitest (Node ESM puro) sin next-auth/DB.
 *
 * El `auth` REAL, cuando se llama como `auth(handler)` (uso de
 * `middleware.ts`), ENVUELVE el handler y le resuelve `request.auth`. Aquí el
 * mock es un passthrough (`(handler) => handler`): el default export de
 * `middleware.ts` queda siendo literalmente la función `async (request) =>
 * {...}`, y cada test inyecta `.auth` a mano en el request — así se ejerce la
 * MISMA lógica de decisión (BUG-2 del smoke F8) sin next-auth real.
 */
const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn((handler: unknown) => handler),
}));
vi.mock("@/lib/auth/config", () => ({ auth: authMock }));

import middleware from "./middleware";

type AuthedRequest = NextRequest & { auth: unknown };

function makeRequest(path: string, auth: unknown = null): AuthedRequest {
  const req = new NextRequest(new URL(path, "http://localhost:3000")) as AuthedRequest;
  req.auth = auth;
  return req;
}

async function run(path: string, auth: unknown = null) {
  const req = makeRequest(path, auth);
  // El segundo argumento (`NextFetchEvent`) no lo usa el handler — el mock lo
  // ignora también.
  return (middleware as unknown as (req: AuthedRequest, ev: unknown) => Promise<Response>)(
    req,
    {}
  );
}

describe("middleware — preview de PixelForge con token pfqa (BUG-2 smoke F8)", () => {
  it("con pfqa y SIN auth, NO redirige a /login (el page component valida el token, no el middleware)", async () => {
    const res = await run("/proyectos/pixelforge/abc-123/preview?pfqa=sometoken", null);
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).not.toBe(307);
  });

  it("la respuesta exenta trae la CSP del preview real: frame-ancestors 'self' (no la de /login)", async () => {
    const res = await run("/proyectos/pixelforge/abc-123/preview?pfqa=sometoken", null);
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("frame-ancestors 'self'");
  });

  it("SIN pfqa, la misma ruta de preview sigue protegida: redirige a /login sin auth", async () => {
    const res = await run("/proyectos/pixelforge/abc-123/preview", null);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("con pfqa mal puesto en OTRA ruta protegida (no /preview), sigue redirigiendo sin auth", async () => {
    const res = await run("/proyectos/pixelforge/abc-123/produccion?pfqa=sometoken", null);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("rutas protegidas normales (sin pfqa) sin auth siguen redirigiendo — la protección general no se tocó", async () => {
    const res = await run("/hoy", null);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("con sesión válida, una ruta protegida normal sigue pasando (sanity, sin regresión)", async () => {
    const res = await run("/hoy", { user: { id: "u1" } });
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).not.toBe(307);
  });
});
