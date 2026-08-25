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

  it("con sesión válida (staff), una ruta protegida normal sigue pasando (sanity, sin regresión)", async () => {
    const res = await run("/hoy", { user: { id: "u1", role: "staff" } });
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).not.toBe(307);
  });
});

/**
 * WO-2026-00051 — rol restringido (`reviewer`): deny-by-default server-side.
 * La política pura vive en src/lib/routes/reviewer-access.ts (con su propio
 * test); aquí se verifica que el MIDDLEWARE la aplica sobre requests reales
 * (método, header next-action, URL directa) y que admin/staff no cambian.
 */
const REVIEWER = { user: { id: "rev-1", role: "reviewer" } };
const ADMIN = { user: { id: "adm-1", role: "admin" } };
const STAFF = { user: { id: "stf-1", role: "staff" } };

const SENSITIVE_PAGES = [
  "/usuarios",
  "/cobros",
  "/clientes",
  "/vps",
  "/accesos",
  "/ia-factory",
  "/documentos",
  "/blog-admin",
  "/smilemore-respuestas",
  "/proyectos",
  "/perfil",
  "/notificaciones",
  "/crecimiento",
];

const OTHER_APIS = [
  ["GET", "/api/growth/brands"],
  ["GET", "/api/pixelforge/runs/abc"],
  ["POST", "/api/blog/view"],
  ["GET", "/api/portal/legacy-session"],
] as const;

const EXCLUDED_WHATSAPP_APIS = [
  ["PUT", "/api/whatsapp-inbox/config"],
  ["POST", "/api/whatsapp-inbox/config/draft"],
  ["POST", "/api/whatsapp-inbox/config/publish"],
  ["POST", "/api/whatsapp-inbox/config/rollback"],
  ["POST", "/api/whatsapp-inbox/contacts"],
  ["POST", "/api/whatsapp-inbox/contacts/5213221234567/notes"],
  ["POST", "/api/whatsapp-inbox/tickets"],
  ["POST", "/api/whatsapp-inbox/examples"],
  ["POST", "/api/whatsapp-inbox/examples/ex-1/active"],
] as const;

const ALLOWED_WHATSAPP_APIS = [
  ["GET", "/api/whatsapp-inbox/conversations"],
  ["GET", "/api/whatsapp-inbox/conversations/5213221234567/messages"],
  ["POST", "/api/whatsapp-inbox/conversations/read"],
  ["POST", "/api/whatsapp-inbox/send"],
  ["POST", "/api/whatsapp-inbox/mode"],
  ["GET", "/api/whatsapp-inbox/coexistence/status"],
  ["GET", "/api/whatsapp-inbox/contacts"],
  ["GET", "/api/whatsapp-inbox/contacts/5213221234567/notes"],
  ["GET", "/api/whatsapp-inbox/memory"],
  ["GET", "/api/whatsapp-inbox/config"],
  ["GET", "/api/whatsapp-inbox/config/versions"],
  ["GET", "/api/whatsapp-inbox/examples"],
  ["POST", "/api/whatsapp-inbox/simulate"],
] as const;

function makeRequestWith(
  path: string,
  auth: unknown,
  init: { method?: string; headers?: Record<string, string> } = {}
): AuthedRequest {
  const req = new NextRequest(new URL(path, "http://localhost:3000"), {
    method: init.method ?? "GET",
    headers: init.headers,
  }) as AuthedRequest;
  req.auth = auth;
  return req;
}

async function runWith(
  path: string,
  auth: unknown,
  init: { method?: string; headers?: Record<string, string> } = {}
) {
  return (middleware as unknown as (req: AuthedRequest, ev: unknown) => Promise<Response>)(
    makeRequestWith(path, auth, init),
    {}
  );
}

describe("middleware — rol reviewer (WO-2026-00051): mínimo privilegio server-side", () => {
  it("reviewer → GET /whatsapp permitido (sin redirect, sin 403)", async () => {
    const res = await runWith("/whatsapp", REVIEWER);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("reviewer → GET /hoy (aterrizaje post-login) redirige a /whatsapp", async () => {
    const res = await runWith("/hoy", REVIEWER);
    expect([302, 307]).toContain(res.status);
    expect(res.headers.get("location")).toBe("http://localhost:3000/whatsapp");
  });

  it.each(SENSITIVE_PAGES)("reviewer → %s por URL directa → 403 (HTML) con link a /whatsapp", async (path) => {
    const res = await runWith(path, REVIEWER, { headers: { accept: "text/html" } });
    expect(res.status).toBe(403);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain('href="/whatsapp"');
    // Sigue llevando la CSP del sitio: el 403 no es una respuesta "desnuda".
    expect(res.headers.get("content-security-policy")).toBeTruthy();
  });

  it.each(SENSITIVE_PAGES)("reviewer → subruta de %s también 403", async (path) => {
    const res = await runWith(`${path}/algo-123`, REVIEWER);
    expect(res.status).toBe(403);
  });

  it.each(ALLOWED_WHATSAPP_APIS)("reviewer → %s %s pasa el middleware", async (method, path) => {
    const res = await runWith(path, REVIEWER, { method });
    expect(res.status).toBe(200);
  });

  it.each(EXCLUDED_WHATSAPP_APIS)("reviewer → %s %s (excluida) → 403 JSON", async (method, path) => {
    const res = await runWith(path, REVIEWER, { method });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
  });

  it.each(OTHER_APIS)("reviewer → %s %s (otra API) → 403", async (method, path) => {
    const res = await runWith(path, REVIEWER, { method });
    expect(res.status).toBe(403);
  });

  it("reviewer → server action (POST + next-action) desde /whatsapp → 403", async () => {
    const res = await runWith("/whatsapp", REVIEWER, {
      method: "POST",
      headers: { "next-action": "7f3a9c1e", accept: "text/x-component" },
    });
    expect(res.status).toBe(403);
  });

  it("reviewer → server action desde la landing pública o /usuarios → 403", async () => {
    for (const path of ["/", "/contact", "/usuarios"]) {
      const res = await runWith(path, REVIEWER, {
        method: "POST",
        headers: { "next-action": "7f3a9c1e" },
      });
      expect(res.status, path).toBe(403);
    }
  });

  it("reviewer → NextAuth y csp-report siguen disponibles (login/logout existentes)", async () => {
    expect((await runWith("/api/auth/session", REVIEWER)).status).toBe(200);
    expect((await runWith("/api/auth/signout", REVIEWER, { method: "POST" })).status).toBe(200);
    expect((await runWith("/api/csp-report", REVIEWER, { method: "POST" })).status).toBe(200);
  });

  it("reviewer → superficie pública en lectura igual que un anónimo; escritura 403", async () => {
    expect((await runWith("/", REVIEWER)).status).toBe(200);
    expect((await runWith("/login", REVIEWER)).status).toBe(200);
    expect((await runWith("/contact", REVIEWER, { method: "POST" })).status).toBe(403);
  });

  it("rol DESCONOCIDO o ausente en la sesión ⇒ restringido (fail-closed)", async () => {
    expect((await runWith("/usuarios", { user: { id: "x", role: "superadmin" } })).status).toBe(403);
    expect((await runWith("/usuarios", { user: { id: "x" } })).status).toBe(403);
    expect((await runWith("/whatsapp", { user: { id: "x" } })).status).toBe(200);
  });

  it("sin sesión, nada cambia: /whatsapp y /usuarios redirigen a /login (no 403)", async () => {
    for (const path of ["/whatsapp", "/usuarios"]) {
      const res = await runWith(path, null);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login");
    }
  });
});

describe("middleware — regresión admin y staff (WO-2026-00051): igual que hoy", () => {
  const ROLES = [
    ["admin", ADMIN],
    ["staff", STAFF],
  ] as const;

  it.each(ROLES)("%s → todas las páginas sensibles + /whatsapp + /hoy pasan", async (_name, auth) => {
    for (const path of [...SENSITIVE_PAGES, "/whatsapp", "/hoy"]) {
      const res = await runWith(path, auth);
      expect(res.status, path).toBe(200);
      expect(res.headers.get("location"), path).toBeNull();
    }
  });

  it.each(ROLES)("%s → las 22 APIs de whatsapp-inbox y otras APIs pasan el middleware", async (_name, auth) => {
    for (const [method, path] of [...ALLOWED_WHATSAPP_APIS, ...EXCLUDED_WHATSAPP_APIS, ...OTHER_APIS]) {
      const res = await runWith(path, auth, { method });
      expect(res.status, `${method} ${path}`).toBe(200);
    }
  });

  it.each(ROLES)("%s → server actions pasan el middleware (el guard de cada action decide)", async (_name, auth) => {
    const res = await runWith("/usuarios", auth, {
      method: "POST",
      headers: { "next-action": "7f3a9c1e" },
    });
    expect(res.status).toBe(200);
  });
});
