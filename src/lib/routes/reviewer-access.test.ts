import { describe, expect, test } from "vitest";
import {
  REVIEWER_API_ALLOWLIST,
  decideRestrictedAccess,
  isRestrictedRole,
  isReviewerAllowedApi,
} from "./reviewer-access";
import { ADMIN_ROUTES } from "./admin-routes";

/**
 * Política pura del rol restringido (WO-2026-00051). Sin auth ni DB: aquí se
 * fija QUÉ se permite; `middleware.test.ts` prueba que el middleware la aplica
 * y `reviewer-access.contract.test.ts` que las rutas llevan el guard correcto.
 */

const decide = (pathname: string, method = "GET", isServerAction = false) =>
  decideRestrictedAccess({ pathname, method, isServerAction });

describe("isRestrictedRole — fail-closed", () => {
  test("admin y staff NO son restringidos (comportamiento previo intacto)", () => {
    expect(isRestrictedRole("admin")).toBe(false);
    expect(isRestrictedRole("staff")).toBe(false);
  });

  test("reviewer es restringido", () => {
    expect(isRestrictedRole("reviewer")).toBe(true);
  });

  test("rol ausente, vacío o desconocido cae en mínimo privilegio", () => {
    expect(isRestrictedRole(undefined)).toBe(true);
    expect(isRestrictedRole(null)).toBe(true);
    expect(isRestrictedRole("")).toBe(true);
    expect(isRestrictedRole("superadmin")).toBe(true);
    expect(isRestrictedRole("Admin")).toBe(true);
  });
});

describe("páginas internas", () => {
  test("/whatsapp y subrutas: permitido (GET)", () => {
    expect(decide("/whatsapp")).toEqual({ kind: "allow" });
    expect(decide("/whatsapp/")).toEqual({ kind: "allow" });
    expect(decide("/whatsapp/algo")).toEqual({ kind: "allow" });
  });

  test("/whatsapp con método de escritura (no server action): denegado", () => {
    expect(decide("/whatsapp", "POST")).toMatchObject({ kind: "deny" });
  });

  test("/hoy (aterrizaje post-login) redirige a /whatsapp solo en GET", () => {
    expect(decide("/hoy")).toEqual({ kind: "redirect", to: "/whatsapp" });
    expect(decide("/hoy", "POST")).toMatchObject({ kind: "deny" });
    expect(decide("/hoy/algo")).toMatchObject({ kind: "deny" });
  });

  test("TODA otra ruta de ADMIN_ROUTES (y subrutas) se deniega por URL directa", () => {
    for (const slug of ADMIN_ROUTES) {
      if (slug === "whatsapp" || slug === "hoy") continue;
      expect(decide(`/${slug}`), `/${slug}`).toEqual({ kind: "deny", reason: "page-not-allowlisted" });
      expect(decide(`/${slug}/abc-123`), `/${slug}/abc-123`).toMatchObject({ kind: "deny" });
    }
  });

  test("la lista sensible del WO está cubierta explícitamente", () => {
    for (const p of [
      "/usuarios",
      "/cobros",
      "/clientes",
      "/cotizaciones",
      "/smilemore-respuestas",
      "/proyectos",
      "/perfil",
      "/notificaciones",
    ]) {
      expect(decide(p), p).toMatchObject({ kind: "deny" });
    }
  });

  test("prefijo parecido no cuela: /whatsapp-algo no es /whatsapp", () => {
    // No está en ADMIN_ROUTES → es superficie pública de solo lectura, no
    // una página interna permitida. Lo importante: no se trata como /whatsapp.
    expect(decide("/whatsapp-algo")).toEqual({ kind: "allow" });
    expect(decide("/whatsapp-algo", "POST")).toMatchObject({ kind: "deny" });
  });
});

describe("server actions", () => {
  test("cualquier POST con next-action se deniega, incluso en /whatsapp y en la landing", () => {
    expect(decide("/whatsapp", "POST", true)).toEqual({ kind: "deny", reason: "server-action" });
    expect(decide("/", "POST", true)).toEqual({ kind: "deny", reason: "server-action" });
    expect(decide("/usuarios", "POST", true)).toEqual({ kind: "deny", reason: "server-action" });
    expect(decide("/contact", "POST", true)).toEqual({ kind: "deny", reason: "server-action" });
  });
});

describe("API routes", () => {
  test("cada regla de la allowlist se permite con su método exacto", () => {
    const ejemplos: Record<string, string> = {
      "GET /conversations": "/api/whatsapp-inbox/conversations",
      "GET /conversations/[phone]/messages": "/api/whatsapp-inbox/conversations/%2B5213221234567/messages",
      "POST /conversations/read": "/api/whatsapp-inbox/conversations/read",
      "POST /send": "/api/whatsapp-inbox/send",
      "POST /mode": "/api/whatsapp-inbox/mode",
      "GET /coexistence/status": "/api/whatsapp-inbox/coexistence/status",
      "GET /contacts": "/api/whatsapp-inbox/contacts",
      "GET /contacts/[phone]/notes": "/api/whatsapp-inbox/contacts/5213221234567/notes",
      "GET /memory": "/api/whatsapp-inbox/memory",
      "GET /config": "/api/whatsapp-inbox/config",
      "GET /config/versions": "/api/whatsapp-inbox/config/versions",
      "GET /examples": "/api/whatsapp-inbox/examples",
      "POST /simulate": "/api/whatsapp-inbox/simulate",
    };
    expect(REVIEWER_API_ALLOWLIST).toHaveLength(13);
    for (const rule of REVIEWER_API_ALLOWLIST) {
      const path = ejemplos[rule.label];
      expect(path, `falta ejemplo para ${rule.label}`).toBeDefined();
      expect(decide(path, rule.method), rule.label).toEqual({ kind: "allow" });
      expect(isReviewerAllowedApi(path, rule.method.toLowerCase())).toBe(true);
    }
  });

  test("mismo path con OTRO método: denegado (PUT /config, POST /contacts, POST /examples, POST notes)", () => {
    expect(decide("/api/whatsapp-inbox/config", "PUT")).toEqual({ kind: "deny", reason: "api-not-allowlisted" });
    expect(decide("/api/whatsapp-inbox/contacts", "POST")).toMatchObject({ kind: "deny" });
    expect(decide("/api/whatsapp-inbox/examples", "POST")).toMatchObject({ kind: "deny" });
    expect(decide("/api/whatsapp-inbox/contacts/123/notes", "POST")).toMatchObject({ kind: "deny" });
    expect(decide("/api/whatsapp-inbox/conversations", "DELETE")).toMatchObject({ kind: "deny" });
  });

  test("mutaciones de configuración y escrituras internas excluidas", () => {
    for (const p of [
      "/api/whatsapp-inbox/config/draft",
      "/api/whatsapp-inbox/config/publish",
      "/api/whatsapp-inbox/config/rollback",
      "/api/whatsapp-inbox/tickets",
      "/api/whatsapp-inbox/examples/abc/active",
    ]) {
      expect(decide(p, "POST"), p).toEqual({ kind: "deny", reason: "api-not-allowlisted" });
    }
  });

  test("cualquier otra API de PixelTEC OS: denegada", () => {
    for (const p of [
      "/api/growth/brands",
      "/api/pixelforge/runs/1",
      "/api/portal/legacy-session",
      "/api/blog/view",
      "/api/whatsapp-inbox",
      "/api/whatsapp-inbox/",
      "/api/whatsapp-inboxx/conversations",
    ]) {
      expect(decide(p), p).toEqual({ kind: "deny", reason: "api-not-allowlisted" });
    }
  });

  test("segmentos [phone] no aceptan barras ni recorridos", () => {
    expect(decide("/api/whatsapp-inbox/conversations/a/b/messages")).toMatchObject({ kind: "deny" });
    expect(decide("/api/whatsapp-inbox/conversations//messages")).toMatchObject({ kind: "deny" });
    expect(decide("/api/whatsapp-inbox/contacts/x/notes/extra")).toMatchObject({ kind: "deny" });
  });

  test("plataforma: NextAuth y csp-report permitidos (login/logout existentes)", () => {
    expect(decide("/api/auth/session")).toEqual({ kind: "allow" });
    expect(decide("/api/auth/csrf")).toEqual({ kind: "allow" });
    expect(decide("/api/auth/signout", "POST")).toEqual({ kind: "allow" });
    expect(decide("/api/csp-report", "POST")).toEqual({ kind: "allow" });
    expect(decide("/api/csp-report", "GET")).toMatchObject({ kind: "deny" });
  });
});

describe("superficie pública", () => {
  test("lectura pública igual que un anónimo; escritura denegada", () => {
    expect(decide("/")).toEqual({ kind: "allow" });
    expect(decide("/login")).toEqual({ kind: "allow" });
    expect(decide("/blog/post")).toEqual({ kind: "allow" });
    expect(decide("/logo.png", "HEAD")).toEqual({ kind: "allow" });
    expect(decide("/contact", "POST")).toEqual({ kind: "deny", reason: "public-write-method" });
    expect(decide("/respuestas/abc", "PUT")).toMatchObject({ kind: "deny" });
  });
});
