import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Acceso REAL por rol a los 24 handlers de /api/whatsapp-inbox
 * (WO-2026-00051 · +3 de gestión en WO-2026-00181).
 *
 * A diferencia de routes-contract.test.ts (que mockea el guard), aquí corre el
 * guard verdadero (`@/lib/auth-guards`) con la autoridad canónica mockeada por
 * rol. Se prueba la segunda capa — independiente del middleware — que decide
 * en cada handler:
 *
 *   reviewer → OK en los 15 de la allowlist presentes en main · 403 en los 9 excluidos
 *   admin    → OK en los 24 (regresión: nada cambia)
 *   staff    → 403 en los 24 (regresión: nada cambia)
 */

const {
  authMock,
  resolveAuthorityMock,
  fetchPixelbotMock,
  whatsappGuardMock,
  listContactsMock,
  upsertContactMock,
  listNotesMock,
  addNoteMock,
  managementConfigMock,
  phoneInfoMock,
  businessProfileMock,
  listTemplatesMock,
  createTemplateMock,
  dbMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  resolveAuthorityMock: vi.fn(),
  fetchPixelbotMock: vi.fn(),
  whatsappGuardMock: vi.fn(),
  listContactsMock: vi.fn(),
  upsertContactMock: vi.fn(),
  listNotesMock: vi.fn(),
  addNoteMock: vi.fn(),
  managementConfigMock: vi.fn(),
  phoneInfoMock: vi.fn(),
  businessProfileMock: vi.fn(),
  listTemplatesMock: vi.fn(),
  createTemplateMock: vi.fn(),
  dbMock: {
    insert: vi.fn(() => ({
      values: vi.fn(() => {
        const p = Promise.resolve(undefined) as Promise<unknown> & { returning?: () => Promise<unknown[]> };
        p.returning = () => Promise.resolve([{ id: "t-1", ticketId: "WA-1" }]);
        return p;
      }),
    })),
  },
}));

vi.mock("@/lib/auth/config", () => ({ auth: authMock }));
vi.mock("@/lib/auth/authority", () => ({ resolveAuthority: resolveAuthorityMock }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/whatsapp-inbox/pixelbot-client", () => ({ fetchPixelbot: fetchPixelbotMock }));
vi.mock("@/lib/db/repos/whatsapp-contacts", () => ({
  listContacts: listContactsMock,
  upsertContact: upsertContactMock,
  listNotes: listNotesMock,
  addNote: addNoteMock,
}));
vi.mock("@/lib/egress-guard", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/egress-guard")>();
  return { ...real, assertWhatsAppEgressAllowed: whatsappGuardMock };
});
// WO-2026-00181: las rutas de gestión hablan con Graph. Aquí solo se prueba el
// acceso por rol, así que el cliente se mockea entero — cero red hacia Meta.
vi.mock("@/lib/whatsapp/management", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/whatsapp/management")>();
  return {
    ...real,
    getManagementConfig: managementConfigMock,
    getPhoneNumberInfo: phoneInfoMock,
    getBusinessProfile: businessProfileMock,
    listMessageTemplates: listTemplatesMock,
    createMessageTemplate: createTemplateMock,
  };
});

// Varias rutas exigen el tenant configurado (503 si falta): valor sintético.
process.env.PIXELBOT_TENANT_ID = "tenant-vitest";

const UID = "3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607";

function req(url: string, init?: { method?: string; body?: unknown }) {
  return new NextRequest(`http://localhost${url}`, {
    method: init?.method ?? "GET",
    ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
}

/** `esperado` solo se declara cuando el éxito no es 200 (p. ej. un 201 al crear). */
type Caso = { nombre: string; invocar: () => Promise<Response>; esperado?: number };

const ALLOWLIST: Caso[] = [
  {
    nombre: "GET /conversations",
    invocar: async () => (await import("./conversations/route")).GET(req("/api/whatsapp-inbox/conversations")),
  },
  {
    nombre: "GET /conversations/[phone]/messages",
    invocar: async () =>
      (await import("./conversations/[phone]/messages/route")).GET(
        req("/api/whatsapp-inbox/conversations/5213221234567/messages"),
        { params: Promise.resolve({ phone: "5213221234567" }) }
      ),
  },
  {
    nombre: "POST /conversations/read",
    invocar: async () =>
      (await import("./conversations/read/route")).POST(
        req("/api/whatsapp-inbox/conversations/read", { method: "POST", body: { phone: "5213221234567" } })
      ),
  },
  {
    nombre: "POST /send",
    invocar: async () =>
      (await import("./send/route")).POST(
        req("/api/whatsapp-inbox/send", { method: "POST", body: { phone: "5213221234567", text: "hola" } })
      ),
  },
  {
    nombre: "POST /mode",
    invocar: async () =>
      (await import("./mode/route")).POST(
        req("/api/whatsapp-inbox/mode", { method: "POST", body: { phone: "5213221234567", mode: "HUMAN" } })
      ),
  },
  {
    nombre: "GET /contacts",
    invocar: async () => (await import("./contacts/route")).GET(req("/api/whatsapp-inbox/contacts")),
  },
  {
    nombre: "GET /contacts/[phone]/notes",
    invocar: async () =>
      (await import("./contacts/[phone]/notes/route")).GET(
        req("/api/whatsapp-inbox/contacts/5213221234567/notes"),
        { params: Promise.resolve({ phone: "5213221234567" }) }
      ),
  },
  {
    nombre: "GET /memory",
    invocar: async () =>
      (await import("./memory/route")).GET(req("/api/whatsapp-inbox/memory?phone=5213221234567")),
  },
  {
    nombre: "GET /config",
    invocar: async () => (await import("./config/route")).GET(req("/api/whatsapp-inbox/config")),
  },
  {
    nombre: "GET /config/versions",
    invocar: async () =>
      (await import("./config/versions/route")).GET(req("/api/whatsapp-inbox/config/versions")),
  },
  {
    nombre: "GET /examples",
    invocar: async () => (await import("./examples/route")).GET(req("/api/whatsapp-inbox/examples")),
  },
  {
    nombre: "POST /simulate",
    invocar: async () =>
      (await import("./simulate/route")).POST(
        req("/api/whatsapp-inbox/simulate", { method: "POST", body: { message: "hola" } })
      ),
  },
  {
    nombre: "GET /account",
    invocar: async () => (await import("./account/route")).GET(req("/api/whatsapp-inbox/account")),
  },
  {
    nombre: "GET /templates",
    invocar: async () => (await import("./templates/route")).GET(req("/api/whatsapp-inbox/templates")),
  },
  {
    nombre: "POST /templates",
    esperado: 201,
    invocar: async () =>
      (await import("./templates/route")).POST(
        req("/api/whatsapp-inbox/templates", {
          method: "POST",
          body: {
            name: "pedido_listo",
            language: "es_MX",
            category: "UTILITY",
            body: "Hola, tu pedido está listo.",
          },
        })
      ),
  },
];

const EXCLUIDOS: Caso[] = [
  {
    nombre: "PUT /config",
    invocar: async () =>
      (await import("./config/route")).PUT(
        req("/api/whatsapp-inbox/config", { method: "PUT", body: { config: { bot_name: "x" } } })
      ),
  },
  {
    nombre: "POST /config/draft",
    invocar: async () =>
      (await import("./config/draft/route")).POST(
        req("/api/whatsapp-inbox/config/draft", { method: "POST", body: { config: { a: 1 } } })
      ),
  },
  {
    nombre: "POST /config/publish",
    invocar: async () =>
      (await import("./config/publish/route")).POST(
        req("/api/whatsapp-inbox/config/publish", { method: "POST", body: { version: 4 } })
      ),
  },
  {
    nombre: "POST /config/rollback",
    invocar: async () =>
      (await import("./config/rollback/route")).POST(
        req("/api/whatsapp-inbox/config/rollback", { method: "POST", body: { version: 3 } })
      ),
  },
  {
    nombre: "POST /contacts",
    invocar: async () =>
      (await import("./contacts/route")).POST(
        req("/api/whatsapp-inbox/contacts", { method: "POST", body: { phone: "5213221234567", patch: {} } })
      ),
  },
  {
    nombre: "POST /contacts/[phone]/notes",
    invocar: async () =>
      (await import("./contacts/[phone]/notes/route")).POST(
        req("/api/whatsapp-inbox/contacts/5213221234567/notes", { method: "POST", body: { text: "nota" } }),
        { params: Promise.resolve({ phone: "5213221234567" }) }
      ),
  },
  {
    nombre: "POST /tickets",
    invocar: async () =>
      (await import("./tickets/route")).POST(
        req("/api/whatsapp-inbox/tickets", { method: "POST", body: { problema: "x", phone: "5213221234567" } })
      ),
  },
  {
    nombre: "POST /examples",
    invocar: async () =>
      (await import("./examples/route")).POST(
        req("/api/whatsapp-inbox/examples", {
          method: "POST",
          body: { customer_msg: "u", ideal_reply: "r" },
        })
      ),
  },
  {
    nombre: "POST /examples/[id]/active",
    invocar: async () =>
      (await import("./examples/[id]/active/route")).POST(
        req("/api/whatsapp-inbox/examples/7/active", { method: "POST", body: { active: true } }),
        { params: Promise.resolve({ id: "7" }) }
      ),
  },
];

function sessionAs(role: "admin" | "staff" | "reviewer") {
  authMock.mockResolvedValue({ user: { id: UID, role, credentialIssuedAt: 1_770_000_000 } });
  resolveAuthorityMock.mockResolvedValue({
    ok: true,
    userId: UID,
    role,
    isAdmin: role === "admin",
    sessionsValidFrom: null,
  });
}

beforeEach(() => {
  authMock.mockReset();
  resolveAuthorityMock.mockReset();
  fetchPixelbotMock.mockReset().mockResolvedValue({ data: { ok: true }, status: 200 });
  whatsappGuardMock.mockReset().mockReturnValue(undefined);
  listContactsMock.mockReset().mockResolvedValue([]);
  upsertContactMock.mockReset().mockResolvedValue({ phone: "5213221234567" });
  listNotesMock.mockReset().mockResolvedValue([]);
  addNoteMock.mockReset().mockResolvedValue({ id: "n-1" });
  managementConfigMock.mockReset().mockReturnValue({
    configured: true,
    phoneNumberId: "111222333444",
    businessAccountId: "999888777666",
    apiVersion: "v21.0",
  });
  phoneInfoMock.mockReset().mockResolvedValue({
    id: "111222333444",
    displayPhoneNumber: "+52 1 322 137 8336",
    verifiedName: "PixelTEC",
    qualityRating: "GREEN",
    nameStatus: "APPROVED",
    codeVerificationStatus: "VERIFIED",
    messagingLimitTier: "TIER_1K",
    platformType: "CLOUD_API",
  });
  businessProfileMock.mockReset().mockResolvedValue({
    about: null,
    address: null,
    description: null,
    email: null,
    profilePictureUrl: null,
    websites: [],
    vertical: null,
  });
  listTemplatesMock.mockReset().mockResolvedValue([]);
  createTemplateMock
    .mockReset()
    .mockResolvedValue({ id: "2002", status: "PENDING", name: "pedido_listo" });
});

describe("cobertura: 24 handlers en main", () => {
  test("15 allowlist + 9 excluidos, sin duplicados", () => {
    const nombres = [...ALLOWLIST, ...EXCLUIDOS].map((c) => c.nombre);
    expect(new Set(nombres).size).toBe(24);
    expect(ALLOWLIST).toHaveLength(15);
    expect(EXCLUIDOS).toHaveLength(9);
  });
});

describe("reviewer", () => {
  test.each(ALLOWLIST.map((c) => [c.nombre, c] as const))("%s → OK (guard real)", async (_n, caso) => {
    sessionAs("reviewer");
    const res = await caso.invocar();
    expect(res.status).toBe(caso.esperado ?? 200);
    expect(resolveAuthorityMock).toHaveBeenCalledWith(UID, 1_770_000_000);
  });

  test.each(EXCLUIDOS.map((c) => [c.nombre, c] as const))(
    "%s → 403 sin tocar dependencias",
    async (_n, caso) => {
      sessionAs("reviewer");
      const res = await caso.invocar();
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "forbidden" });
      expect(fetchPixelbotMock).not.toHaveBeenCalled();
      expect(upsertContactMock).not.toHaveBeenCalled();
      expect(addNoteMock).not.toHaveBeenCalled();
      expect(dbMock.insert).not.toHaveBeenCalledWith(expect.objectContaining({ _: { name: "tickets" } }));
    }
  );
});

describe("regresión admin: los 24 handlers siguen respondiendo OK", () => {
  test.each([...ALLOWLIST, ...EXCLUIDOS].map((c) => [c.nombre, c] as const))("%s", async (_n, caso) => {
    sessionAs("admin");
    const res = await caso.invocar();
    expect(res.status).toBe(caso.esperado ?? 200);
  });
});

describe("regresión staff: los 24 handlers siguen en 403", () => {
  test.each([...ALLOWLIST, ...EXCLUIDOS].map((c) => [c.nombre, c] as const))("%s", async (_n, caso) => {
    sessionAs("staff");
    const res = await caso.invocar();
    expect(res.status).toBe(403);
    expect(fetchPixelbotMock).not.toHaveBeenCalled();
  });
});

describe("sin sesión: 401 en todos", () => {
  test.each([...ALLOWLIST, ...EXCLUIDOS].map((c) => [c.nombre, c] as const))("%s", async (_n, caso) => {
    authMock.mockResolvedValue(null);
    const res = await caso.invocar();
    expect(res.status).toBe(401);
  });
});
